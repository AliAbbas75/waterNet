const Alert = require("../models/Alert");
const { logAudit } = require("./audit.service");
const { emit: socketEmit } = require("./socket.service");
const { notifyAdminsOfAlert } = require("./alert.notification.service");

// Alert types whose response still matters after the symptom disappears. When
// the condition clears on its own these do NOT close — they move to
// CLEARED_PENDING_REVIEW and wait for a person to record what was done.
//
// A water-quality breach is the case that motivates this: one reading back
// inside limits used to silently close a CRITICAL incident, leaving no record
// that the plant was ever shut or the public ever warned.
const REQUIRES_HUMAN_REVIEW = new Set(["QUALITY_UNSAFE"]);

// Any status that is not a closed alert. Used for de-duplication so a condition
// that persists does not spawn one alert per detection cycle.
const LIVE_STATUSES = ["OPEN", "ACK", "CLEARED_PENDING_REVIEW"];

function scopeOf(alert) {
  return {
    plantId: alert.plantId || null,
    deviceId: alert.deviceId || null,
    inventoryItemId: alert.inventoryItemId || null
  };
}

/**
 * Raises an alert, or reuses the live one for the same condition.
 *
 * Returns { alert, created }. `created` is false when an existing live alert
 * covered the same condition, so callers can avoid re-notifying.
 */
async function raiseAlert({
  type,
  severity = "INFO",
  plantId = null,
  deviceId = null,
  inventoryItemId = null,
  message,
  meta = null,
  notify = true
}) {
  const scope = { type, plantId, deviceId, inventoryItemId };
  const existing = await Alert.findOne({ ...scope, status: { $in: LIVE_STATUSES } });

  if (existing) {
    // The condition came back while a previous alert was still awaiting review.
    // Reopen it rather than creating a second incident for the same thing —
    // that keeps one auditable thread per condition.
    if (existing.status === "CLEARED_PENDING_REVIEW") {
      existing.status = "OPEN";
      existing.conditionClearedAt = null;
      await existing.save();

      await logAudit({
        event: "alert.reopened",
        targetType: "ALERT",
        targetId: existing._id,
        meta: { type, severity, reason: "condition recurred before review", ...meta }
      });
      socketEmit("alert:new", { alert: existing });
    }
    return { alert: existing, created: false };
  }

  const alert = await Alert.create({
    type,
    severity,
    plantId,
    deviceId,
    inventoryItemId,
    message
  });

  await logAudit({
    event: "alert.raised",
    targetType: "ALERT",
    targetId: alert._id,
    meta: { type, severity, message, ...scopeOf(alert), ...meta }
  });

  socketEmit("alert:new", { alert });

  if (notify) {
    notifyAdminsOfAlert(alert).catch((err) =>
      console.error("Alert notification error:", err?.message || err)
    );
  }

  return { alert, created: true };
}

/**
 * The monitored condition stopped. Closes matching live alerts, except those
 * whose type requires human review — those park in CLEARED_PENDING_REVIEW.
 *
 * Replaces the bare `Alert.updateMany({ status: 'RESOLVED' })` calls, which
 * closed alerts with no actor, no reason and no audit trail.
 */
async function clearAlerts({ type, plantId = null, deviceId = null, inventoryItemId = null, reason = null }) {
  const scope = { type };
  if (plantId) scope.plantId = plantId;
  if (deviceId) scope.deviceId = deviceId;
  if (inventoryItemId) scope.inventoryItemId = inventoryItemId;

  const live = await Alert.find({ ...scope, status: { $in: LIVE_STATUSES } });
  if (!live.length) return { cleared: 0, pendingReview: 0 };

  const now = new Date();
  const needsReview = REQUIRES_HUMAN_REVIEW.has(type);
  let cleared = 0;
  let pendingReview = 0;

  for (const alert of live) {
    if (alert.status === "CLEARED_PENDING_REVIEW") continue; // already parked

    alert.conditionClearedAt = now;
    if (needsReview) {
      alert.status = "CLEARED_PENDING_REVIEW";
      pendingReview += 1;
    } else {
      alert.status = "RESOLVED";
      alert.resolvedAt = now;
      cleared += 1;
    }
    await alert.save();

    await logAudit({
      event: needsReview ? "alert.cleared_pending_review" : "alert.auto_resolved",
      targetType: "ALERT",
      targetId: alert._id,
      meta: { type, reason, ...scopeOf(alert) }
    });

    socketEmit("alert:updated", { alert });
  }

  return { cleared, pendingReview };
}

/** A person takes ownership of an open alert. */
async function acknowledgeAlert({ alertId, user, req = null }) {
  const alert = await Alert.findById(alertId);
  if (!alert) return { error: "NOT_FOUND" };
  if (alert.status === "RESOLVED") return { error: "ALREADY_RESOLVED" };

  alert.status = "ACK";
  alert.ackAt = new Date();
  alert.ackByUserId = user._id;
  await alert.save();

  await logAudit({
    event: "alert.acknowledged",
    req,
    actorUserId: user._id,
    targetType: "ALERT",
    targetId: alert._id,
    meta: { type: alert.type, severity: alert.severity }
  });

  socketEmit("alert:updated", { alert });
  return { alert };
}

/**
 * A person closes an alert. The optional note is recorded to the audit trail —
 * it becomes mandatory in Phase 2 when tickets own the response.
 */
async function resolveAlert({ alertId, user, req = null, note = null }) {
  const alert = await Alert.findById(alertId);
  if (!alert) return { error: "NOT_FOUND" };
  if (alert.status === "RESOLVED") return { error: "ALREADY_RESOLVED" };

  const previousStatus = alert.status;
  alert.status = "RESOLVED";
  alert.resolvedAt = new Date();
  alert.resolvedByUserId = user._id;
  await alert.save();

  await logAudit({
    event: "alert.resolved",
    req,
    actorUserId: user._id,
    targetType: "ALERT",
    targetId: alert._id,
    meta: {
      type: alert.type,
      severity: alert.severity,
      previousStatus,
      note,
      // Closing straight from OPEN means nobody acknowledged it first; worth
      // being able to query for once the ticket lifecycle lands.
      skippedAck: previousStatus === "OPEN"
    }
  });

  socketEmit("alert:updated", { alert });
  return { alert };
}

module.exports = {
  raiseAlert,
  clearAlerts,
  acknowledgeAlert,
  resolveAlert,
  REQUIRES_HUMAN_REVIEW,
  LIVE_STATUSES
};
