const ThresholdConfig = require("../models/ThresholdConfig");
const WaterQualityState = require("../models/WaterQualityState");
const Plant = require("../models/Plant");
const TelemetryReading = require("../models/TelemetryReading");
const Alert = require("../models/Alert");

// Evaluate water quality for a plant/device
async function evaluateQuality(plantId, deviceId) {
  // Get latest telemetry
  const latest = await TelemetryReading.findOne({ plantId, deviceId })
    .sort({ timestamp: -1 });

  if (!latest) {
    // No data
    await WaterQualityState.findOneAndUpdate(
      { plantId, deviceId },
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
  const params = ['pH', 'turbidity', 'temperature', 'TDS'];

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
    { plantId, deviceId },
    {
      category: overallCategory,
      reasons,
      lastEvaluatedAt: new Date()
    },
    { upsert: true }
  );

  // Generate alert if UNSAFE
  if (overallCategory === 'UNSAFE') {
    const existing = await Alert.findOne({
      type: 'QUALITY_UNSAFE',
      plantId,
      deviceId,
      status: { $in: ['OPEN', 'ACK'] }
    });

    if (!existing) {
      await Alert.create({
        type: 'QUALITY_UNSAFE',
        severity: 'CRITICAL',
        plantId,
        deviceId,
        message: `Water quality unsafe at plant ${plantId}`
      });
    }
  }

  return overallCategory;
}

exports.evaluate = async (req, res, next) => {
  try {
    const { plantId, deviceId } = req.body;

    if (!plantId || !deviceId) {
      return res.status(400).json({ error: 'plantId and deviceId required' });
    }

    const category = await evaluateQuality(plantId, deviceId);
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

    // Get states for all devices at this plant
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