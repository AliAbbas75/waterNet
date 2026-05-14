const Alert = require("../models/Alert");

function parseDateQuery(name, value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error(`${name} must be a valid date (ISO 8601 recommended)`);
    err.statusCode = 400;
    throw err;
  }
  return date;
}

exports.getAlerts = async (req, res, next) => {
  try {
    const { status, type, plantId, deviceId, from, to } = req.query;
    let query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (plantId) query.plantId = plantId;
    if (deviceId) query.deviceId = deviceId;

    const fromDate = parseDateQuery("from", from);
    const toDate = parseDateQuery("to", to);
    if (fromDate && toDate && fromDate > toDate) {
      const err = new Error("from must be before to");
      err.statusCode = 400;
      throw err;
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = fromDate;
      if (toDate) query.createdAt.$lte = toDate;
    }

    const alerts = await Alert.find(query)
      .populate('plantId', 'name')
      .populate('deviceId', 'deviceId')
      .populate('inventoryItemId', 'name')
      .sort({ createdAt: -1 });

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