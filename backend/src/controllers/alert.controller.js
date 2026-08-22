const Alert = require("../models/Alert");
const {
  acknowledgeAlert: acknowledge,
  resolveAlert: resolve
} = require("../services/alert.service");

function populate(id) {
  return Alert.findById(id)
    .populate("plantId", "name")
    .populate("deviceId", "deviceId")
    .populate("inventoryItemId", "name");
}

// WARN retained so alerts written before the ladder change still sort sanely.
const SEVERITY_ORDER = { CRITICAL: 0, MAJOR: 1, WARN: 1, MINOR: 2, INFO: 3 };

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
    const result = await acknowledge({ alertId: req.params.id, user: req.user, req });
    if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Alert not found' });
    if (result.error === 'ALREADY_RESOLVED') {
      return res.status(409).json({ error: 'Alert is already resolved' });
    }
    const alert = await populate(result.alert._id);
    res.json({ alert });
  } catch (err) {
    next(err);
  }
};

exports.resolveAlert = async (req, res, next) => {
  try {
    // The note is optional for now and recorded to the audit trail. It becomes
    // mandatory in Phase 2, when tickets own the response and closing one
    // without saying what was done stops being acceptable.
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() || null : null;
    const result = await resolve({ alertId: req.params.id, user: req.user, req, note });
    if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Alert not found' });
    if (result.error === 'ALREADY_RESOLVED') {
      return res.status(409).json({ error: 'Alert is already resolved' });
    }
    const alert = await populate(result.alert._id);
    res.json({ alert });
  } catch (err) {
    next(err);
  }
};
