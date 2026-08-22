const AuditLog = require("../models/AuditLog");

/**
 * Appends an audit entry. Never throws: an audit failure must not roll back the
 * operation being audited, but it is logged loudly so silent gaps are visible.
 *
 * `req` is optional — system-raised events (MQTT ingestion, cron sweeps) have no
 * HTTP request, and pass actorUserId: null to mean "the system did this".
 */
async function logAudit({
  event,
  req = null,
  actorUserId = null,
  targetUserId = null,
  targetType = null,
  targetId = null,
  meta = null
}) {
  if (!event) return;
  try {
    await AuditLog.create({
      event,
      actorUserId,
      targetUserId,
      targetType,
      targetId,
      ip: req?.ip || req?.connection?.remoteAddress || null,
      userAgent: req?.headers?.["user-agent"] || null,
      meta
    });
  } catch (err) {
    console.warn("audit_log_failed", event, err?.message || err);
  }
}

module.exports = { logAudit };
