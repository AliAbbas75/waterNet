const AuditLog = require("../models/AuditLog");

async function logAudit({ event, req, actorUserId = null, targetUserId = null, meta = null }) {
  if (!event) return;
  try {
    await AuditLog.create({
      event,
      actorUserId,
      targetUserId,
      ip: req?.ip || req?.connection?.remoteAddress || null,
      userAgent: req?.headers?.["user-agent"] || null,
      meta
    });
  } catch (err) {
    console.warn("audit_log_failed", err?.message || err);
  }
}

module.exports = { logAudit };
