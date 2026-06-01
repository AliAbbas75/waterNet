const Alert = require("../models/Alert");

exports.getAlerts = async (req, res, next) => {
  try {
    const { status, type, plantId, deviceId } = req.query;
    let query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (plantId) query.plantId = plantId;
    if (deviceId) query.deviceId = deviceId;

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