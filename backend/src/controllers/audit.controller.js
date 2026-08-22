const AuditLog = require("../models/AuditLog");

exports.listAuditLogs = async (req, res, next) => {
  try {
    const { event, actor, target, limit } = req.query || {};
    const query = {};
    if (event) query.event = String(event);
    if (actor) query.actorUserId = actor;
    if (target) query.targetUserId = target;

    const pageSize = Math.min(Number(limit || 50), 200);
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .lean();

    res.json({ logs });
  } catch (err) {
    next(err);
  }
};
