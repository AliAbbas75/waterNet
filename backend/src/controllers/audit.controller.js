const AuditLog = require("../models/AuditLog");
const { CATEGORIES, SYSTEM, categoryOf, filterFor } = require("../services/auditCategory");

exports.listAuditLogs = async (req, res, next) => {
  try {
    const { event, actor, target, targetType, targetId, category, limit } = req.query || {};
    const query = {};
    if (event) query.event = String(event);
    if (actor) query.actorUserId = actor;
    if (target) query.targetUserId = target;
    // Any entity, not just users — this is what lets a single alert or ticket
    // show its own history rather than the whole system's.
    if (targetType) query.targetType = String(targetType);
    if (targetId) query.targetId = targetId;

    const categoryFilter = filterFor(category);
    if (categoryFilter) Object.assign(query, categoryFilter);

    const pageSize = Math.min(Number(limit || 50), 200);
    const logs = await AuditLog.find(query)
      .populate('actorUserId', 'display_name email role')
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .lean();

    res.json({ logs: logs.map((l) => ({ ...l, category: categoryOf(l.event) })) });
  } catch (err) {
    next(err);
  }
};

/**
 * Per-category counts for the audit view's section headers. Computed server-side
 * so the numbers reflect the whole log, not just the page currently loaded.
 */
exports.auditSummary = async (req, res, next) => {
  try {
    const rows = await AuditLog.aggregate([
      { $group: { _id: "$event", n: { $sum: 1 } } }
    ]);

    const counts = {};
    let total = 0;
    for (const row of rows) {
      const key = categoryOf(row._id);
      counts[key] = (counts[key] || 0) + row.n;
      total += row.n;
    }

    const categories = [...CATEGORIES, SYSTEM]
      .map((c) => ({ key: c.key, label: c.label, count: counts[c.key] || 0 }))
      .filter((c) => c.count > 0);

    res.json({ total, categories });
  } catch (err) {
    next(err);
  }
};
