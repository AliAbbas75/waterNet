const Device = require("../models/Device");
const Plant = require("../models/Plant");
const TelemetryReading = require("../models/TelemetryReading");

exports.getDevices = async (req, res, next) => {
  try {
    const { status, plantId, disabled } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (plantId) {
      query.plantId = plantId;
    }

    if (disabled !== undefined) {
      query.disabled = disabled === 'true';
    }

    const devices = await Device.find(query).populate('plantId', 'name').sort({ createdAt: -1 });
    res.json({ devices });
  } catch (err) {
    next(err);
  }
};

exports.getDevice = async (req, res, next) => {
  try {
    const device = await Device.findById(req.params.id).populate('plantId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({ device });
  } catch (err) {
    next(err);
  }
};

exports.createDevice = async (req, res, next) => {
  try {
    const { deviceId, plantId, installDate, status, firmwareVersion } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    // Check if deviceId already exists
    const existing = await Device.findOne({ deviceId });
    if (existing) {
      return res.status(400).json({ error: 'Device with this deviceId already exists' });
    }

    const device = new Device({
      deviceId,
      plantId,
      installDate,
      status: status || 'AVAILABLE',
      firmwareVersion
    });

    await device.save();
    res.status(201).json({ device });
  } catch (err) {
    next(err);
  }
};

exports.updateDevice = async (req, res, next) => {
  try {
    const { plantId, installDate, status, firmwareVersion, disabled } = req.body;

    const device = await Device.findByIdAndUpdate(
      req.params.id,
      { plantId, installDate, status, firmwareVersion, disabled },
      { new: true, runValidators: true }
    ).populate('plantId', 'name');

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ device });
  } catch (err) {
    next(err);
  }
};

exports.installDevice = async (req, res, next) => {
  try {
    const { plantId } = req.body;

    if (!plantId) {
      return res.status(400).json({ error: 'plantId is required' });
    }

    // Check if plant exists
    const plant = await Plant.findById(plantId);
    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const device = await Device.findByIdAndUpdate(
      req.params.id,
      {
        plantId,
        status: 'INSTALLED',
        installDate: new Date()
      },
      { new: true, runValidators: true }
    ).populate('plantId', 'name');

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ device });
  } catch (err) {
    next(err);
  }
};

exports.uninstallDevice = async (req, res, next) => {
  try {
    const device = await Device.findByIdAndUpdate(
      req.params.id,
      {
        plantId: null,
        status: 'AVAILABLE',
        installDate: null
      },
      { new: true, runValidators: true }
    ).populate('plantId', 'name');

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ device });
  } catch (err) {
    next(err);
  }
};

exports.deleteDevice = async (req, res, next) => {
  try {
    const device = await Device.findByIdAndDelete(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({ message: 'Device deleted' });
  } catch (err) {
    next(err);
  }
};

// Get recent readings for device
exports.getDeviceReadings = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const readings = await TelemetryReading.find({ deviceId: req.params.id })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({ readings });
  } catch (err) {
    next(err);
  }
};