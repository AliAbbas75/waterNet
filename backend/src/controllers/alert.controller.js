const Alert = require("../models/Alert");

const SEVERITY_ORDER = { CRITICAL: 0, WARN: 1, INFO: 2 };

exports.getAlerts = async (req, res, next) => {
  try {
    const { status, type, severity, plantId, deviceId } = req.query;
    let query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (severity) query.severity = severity;
    if (plantId) query.plantId = plantId;
    if (deviceId) query.deviceId = deviceId;

    const alerts = await Alert.find(query)
      .populate('plantId', 'name')
      .populate('deviceId', 'deviceId')
      .populate('inventoryItemId', 'name')
      .sort({ createdAt: -1 });

    // Sort CRITICAL first, then WARN, then INFO, preserving time order within each group
    alerts.sort((a, b) => {
      const sd = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
      if (sd !== 0) return sd;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({ alerts });
  } catch (err) {
    next(err);
  }
};

exports.ackAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        status: 'ACK',
        ackAt: new Date(),
        ackByUserId: req.user._id
      },
      { new: true }
    ).populate('plantId', 'name').populate('deviceId', 'deviceId').populate('inventoryItemId', 'name');

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ alert });
  } catch (err) {
    next(err);
  }
};

exports.resolveAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedByUserId: req.user._id
      },
      { new: true }
    ).populate('plantId', 'name').populate('deviceId', 'deviceId').populate('inventoryItemId', 'name');

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ alert });
  } catch (err) {
    next(err);
  }
};