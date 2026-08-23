const ThresholdConfig = require("../models/ThresholdConfig");
const WaterQualityState = require("../models/WaterQualityState");
const Plant = require("../models/Plant");
const TelemetryReading = require("../models/TelemetryReading");
const Device = require("../models/Device");
const mongoose = require("mongoose");
const { raiseAlert, clearAlerts } = require("../services/alert.service");

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

    if (value < config.safeMin || value > config.safeMax) {
      if ((config.warnMin !== null && value < config.warnMin) ||
          (config.warnMax !== null && value > config.warnMax)) {
        category = 'WARNING';
        threshold = 'warn';
      } else if ((config.unsafeMin !== null && value < config.unsafeMin) ||
                 (config.unsafeMax !== null && value > config.unsafeMax)) {
        category = 'UNSAFE';
        threshold = 'unsafe';
      } else {
        category = 'WARNING'; // between safe and warn
        threshold = 'warn';
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

  // Save state
  await WaterQualityState.findOneAndUpdate(
    { plantId, deviceId: deviceRef },
    {
      category: overallCategory,
      reasons,
      lastEvaluatedAt: new Date()
    },
    { upsert: true }
  );

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
      context: { plantName: plantDoc?.name, parameters: breached.join(', ') }
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