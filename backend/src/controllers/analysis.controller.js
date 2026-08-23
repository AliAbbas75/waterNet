const ThresholdConfig = require("../models/ThresholdConfig");
const WaterQualityState = require("../models/WaterQualityState");
const Plant = require("../models/Plant");
const TelemetryReading = require("../models/TelemetryReading");
const Device = require("../models/Device");
const mongoose = require("mongoose");
const { raiseAlert, clearAlerts } = require("../services/alert.service");

// Consecutive out-of-range evaluations required before a breach is believed.
// Tunable because the right number depends on sampling rate: at a 3-second
// cadence three readings is nine seconds, at 30 minutes it is an hour and a half.
function unsafeRunRequired() {
  const raw = Number(process.env.QUALITY_UNSAFE_CONSECUTIVE);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
}

// Evaluate water quality for a plant/device
async function evaluateQuality(plantId, deviceRef, deviceKey) {
  // Get latest telemetry
  const telemetryQuery = { plantId, $or: [] };
  if (deviceRef) telemetryQuery.$or.push({ deviceRef });
  if (deviceKey) telemetryQuery.$or.push({ deviceId: deviceKey });

  if (telemetryQuery.$or.length === 0) {
    return null;
  }

  const latest = await TelemetryReading.findOne(telemetryQuery).sort({ timestamp: -1 });

  if (!latest) {
    // No data
    await WaterQualityState.findOneAndUpdate(
      { plantId, deviceId: deviceRef },
      {
        category: 'NO_DATA',
        reasons: [],
        lastEvaluatedAt: new Date()
      },
      { upsert: true }
    );
    return;
  }

  // Get thresholds: plant-specific or global
  const thresholds = {};
  const params = ['pH', 'turbidity', 'TDS', 'flowRate'];

  for (const param of params) {
    let config = await ThresholdConfig.findOne({ plantId, parameter: param });
    if (!config) {
      config = await ThresholdConfig.findOne({ plantId: null, parameter: param });
    }
    if (config) {
      thresholds[param] = config;
    }
  }

  // Evaluate
  const reasons = [];
  let overallCategory = 'SAFE';

  for (const param of params) {
    const value = latest.readings[param];
    if (value === null || value === undefined) continue;

    const config = thresholds[param];
    if (!config) continue;

    let category = 'SAFE';
    let threshold = 'safe';

    // The bands are nested: safe sits inside warn, warn inside unsafe. So the
    // question is which band the value has escaped, and it must be asked from
    // the inside out.
    //
    // This was previously inverted — "beyond the warn bounds" returned WARNING,
    // and because any value outside the unsafe band is also outside the warn
    // band, the UNSAFE branch was unreachable. No reading in this database has
    // ever been classified UNSAFE, however contaminated.
    if (value < config.safeMin || value > config.safeMax) {
      const withinWarnBand =
        (config.warnMin === null || value >= config.warnMin) &&
        (config.warnMax === null || value <= config.warnMax);

      if (withinWarnBand) {
        category = 'WARNING';
        threshold = 'warn';
      } else {
        category = 'UNSAFE';
        threshold = 'unsafe';
      }
    }

    if (category === 'UNSAFE' || (category === 'WARNING' && overallCategory === 'SAFE')) {
      overallCategory = category;
    }

    reasons.push({
      parameter: param,
      value,
      threshold,
      message: `${param} is ${category.toLowerCase()} (${value})`
    });
  }

  // A breach must persist before it is believed. One reading out of range is a
  // bubble past the probe or a sensor glitch; acting on it would close a public
  // water plant on noise. Only a sustained run raises the alert.
  const previousState = await WaterQualityState.findOne({ plantId, deviceId: deviceRef }).lean();
  const consecutiveUnsafe =
    overallCategory === 'UNSAFE' ? (previousState?.consecutiveUnsafe || 0) + 1 : 0;

  await WaterQualityState.findOneAndUpdate(
    { plantId, deviceId: deviceRef },
    {
      category: overallCategory,
      reasons,
      lastEvaluatedAt: new Date(),
      consecutiveUnsafe
    },
    { upsert: true }
  );

  const sustained = consecutiveUnsafe >= unsafeRunRequired();

  if (overallCategory === 'UNSAFE' && !sustained) {
    // Breaching but not yet confirmed. Recorded in the state so the UI can show
    // it building, deliberately not alerted on.
    console.log(
      `Quality breach ${consecutiveUnsafe}/${unsafeRunRequired()} at plant ${plantId} — not yet sustained`
    );
    return overallCategory;
  }

  if (overallCategory === 'UNSAFE') {
    const breached = reasons.filter((r) => r.threshold !== 'safe').map((r) => r.parameter);
    // Only queried on an actual breach, and raiseAlert de-duplicates after, so
    // this does not run per telemetry message.
    const plantDoc = await Plant.findById(plantId).select('name').lean();

    await raiseAlert({
      type: 'QUALITY_UNSAFE',
      plantId,
      deviceId: deviceRef,
      message: `Water quality unsafe at plant ${plantDoc?.name || plantId}`,
      meta: { reasons: breached },
      // The readings themselves travel to the work order. A maintainer opening
      // the ticket should not have to go and reconstruct which value breached
      // which limit — by then the readings have moved on.
      context: {
        plantName: plantDoc?.name,
        parameters: breached.join(', '),
        readings: reasons
          .filter((r) => r.threshold !== 'safe')
          .map((r) => `${r.parameter} ${r.value}`)
          .join(', '),
        thresholds: reasons
          .filter((r) => r.threshold !== 'safe')
          .map((r) => `${r.parameter} ${r.threshold}`)
          .join(', '),
        consecutiveUnsafe: `${consecutiveUnsafe} consecutive readings`,
        deviceName: deviceKey
      }
    });
  } else {
    // Readings came back inside limits. The alert stops being OPEN, but a
    // CRITICAL water-quality incident does not close itself — clearAlerts parks
    // it in CLEARED_PENDING_REVIEW until a person records what was done.
    await clearAlerts({
      type: 'QUALITY_UNSAFE',
      plantId,
      deviceId: deviceRef,
      reason: `readings returned to ${overallCategory}`
    });
  }

  return overallCategory;
}

exports.evaluate = async (req, res, next) => {
  try {
    const { plantId, deviceId } = req.body;

    if (!plantId || !deviceId) {
      return res.status(400).json({ error: 'plantId and deviceId required' });
    }

    let device = null;
    if (mongoose.Types.ObjectId.isValid(deviceId)) {
      device = await Device.findById(deviceId);
    }
    if (!device) {
      device = await Device.findOne({ deviceId });
    }
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (device.plantId && device.plantId.toString() !== String(plantId)) {
      return res.status(400).json({ error: 'Device does not belong to this plant' });
    }

    const category = await evaluateQuality(plantId, device._id, device.deviceId);
    res.json({ category });
  } catch (err) {
    next(err);
  }
};

exports.getPlantState = async (req, res, next) => {
  try {
    const plant = await Plant.findById(req.params.id);
    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Every device at the plant, pinned or not — the parameter cards take the
    // worst category across devices, and that has to agree with the alert feed
    // and the dashboard's unsafe count. The pin only steers the trends chart.
    const states = await WaterQualityState.find({ plantId: req.params.id })
      .populate('deviceId', 'deviceId availability');

    res.json({ plant, states });
  } catch (err) {
    next(err);
  }
};

// Admin CRUD for thresholds
exports.getThresholds = async (req, res, next) => {
  try {
    const { plantId } = req.query;
    const query = plantId ? { plantId } : {};
    const thresholds = await ThresholdConfig.find(query).populate('plantId', 'name');
    res.json({ thresholds });
  } catch (err) {
    next(err);
  }
};

exports.createThreshold = async (req, res, next) => {
  try {
    const threshold = new ThresholdConfig(req.body);
    await threshold.save();
    res.status(201).json({ threshold });
  } catch (err) {
    next(err);
  }
};

exports.updateThreshold = async (req, res, next) => {
  try {
    const threshold = await ThresholdConfig.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!threshold) {
      return res.status(404).json({ error: 'Threshold not found' });
    }
    res.json({ threshold });
  } catch (err) {
    next(err);
  }
};

exports.deleteThreshold = async (req, res, next) => {
  try {
    await ThresholdConfig.findByIdAndDelete(req.params.id);
    res.json({ message: 'Threshold deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports.evaluateQuality = evaluateQuality;