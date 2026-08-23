const Alert = require("../models/Alert");
const MaintenanceTask = require("../models/MaintenanceTask");
const Plant = require("../models/Plant");
const Device = require("../models/Device");
const InventoryItem = require("../models/InventoryItem");
const { severityFor, ticketForAlert } = require("./alert.policy");
const { graceSecondsFor } = require("./deviceHealth.service");
const { summariseWindow } = require("./metricsWindow.service");
const { assignTicket, cancelTicket, LIVE_TICKET_STATUSES } = require("./ticket.service");
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

function humanDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * The names AND the evidence behind an alert.
 *
 * Detection paths pass what they already hold; everything else is read back
 * from the alert's own references, so a ticket opened when somebody assigns a
 * two-hour-old alert carries the same detail as one raised automatically.
 *
 * Times are rendered here rather than stored raw because they are a record of
 * what was true when the alert fired — "silent for 41 minutes" answers a
 * different question an hour later than a live lookup would.
 */
async function contextForAlert(alert) {
  const ctx = {};
  const raisedAt = alert.createdAt ? new Date(alert.createdAt) : new Date();

  if (alert.plantId) {
    const plant = await Plant.findById(alert.plantId).select("name").lean();
    if (plant) ctx.plantName = plant.name;
  }

  if (alert.deviceId) {
    const device = await Device.findById(alert.deviceId)
      .select("deviceId lastSeenAt expectedIntervalSeconds availabilityFlips flappingSince")
      .lean();
    if (device) {
      ctx.deviceName = device.deviceId;
      if (device.lastSeenAt) {
        ctx.lastSeenAt = new Date(device.lastSeenAt).toISOString();
        ctx.silentFor = humanDuration(raisedAt - new Date(device.lastSeenAt));
      }
      if (device.expectedIntervalSeconds) {
        ctx.expectedInterval = `${device.expectedIntervalSeconds}s`;
        ctx.gracePeriod = `${graceSecondsFor(device)}s`;
      }
      if (Array.isArray(device.availabilityFlips) && device.availabilityFlips.length) {
        ctx.flips = device.availabilityFlips.length;
        ctx.flapWindow = `${process.env.DEVICE_FLAP_WINDOW_MINUTES || 15} minutes`;
      }
      if (device.flappingSince) ctx.flappingSince = new Date(device.flappingSince).toISOString();
    }
  }

  if (alert.inventoryItemId) {
    const item = await InventoryItem.findById(alert.inventoryItemId)
      .select("name quantity reorderThreshold unit")
      .lean();
    if (item) {
      ctx.itemName = item.name;
      ctx.quantity = `${item.quantity} ${item.unit || "units"}`;
      ctx.reorderThreshold = `${item.reorderThreshold} ${item.unit || "units"}`;
    }
  }

  return ctx;
}

/**
 * Raises an alert, or reuses the live one for the same condition.
 *
 * Returns { alert, created }. `created` is false when an existing live alert
 * covered the same condition, so callers can avoid re-notifying.
 */
async function raiseAlert({
  type,
  plantId = null,
  deviceId = null,
  inventoryItemId = null,
  message,
  meta = null,
  context = {},
  notify = true
}) {
  // Severity is the policy's to decide. Call sites passing their own is how the
  // same condition ended up MAJOR in one place and CRITICAL in another.
  const severity = severityFor(type);
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

  const ticket = await openTicketForAlert(alert, context);
  await setAdvisory(alert, context);

  if (notify) {
    notifyAdminsOfAlert(alert).catch((err) =>
      console.error("Alert notification error:", err?.message || err)
    );
  }

  return { alert, ticket, created: true };
}

/**
 * Opens the work order an alert demands, per the policy table. Returns null for
 * types that raise no ticket, unless `force` — a person acting by hand.
 *
 * The ticket starts in TRIAGE with no assignee: an admin routes it. That is the
 * whole point of the bridge — an alert produces something a named person owns,
 * rather than a row someone can wave away.
 */
async function openTicketForAlert(
  alert,
  context = {},
  { force = false, openedBy = null, req = null, reason = null } = {}
) {
  // What the caller knew wins, but anything it did not supply is read back from
  // the alert's own references — so a ticket never opens with a blank record
  // just because the detection path was terse.
  const fullContext = { ...(await contextForAlert(alert)), ...context };
  const spec = ticketForAlert(alert, fullContext, { force });
  if (!spec) return null;

  const { checklist, diagnostics, ...fields } = spec;

  // A condition returning after its ticket closed gets a new ticket linked to
  // the last one, rather than reopening it. Each response stays cleanly
  // auditable and the chain makes a recurring fault visible as a pattern.
  const previous = await MaintenanceTask.findOne({
    "externalRef.type": "ALERT",
    plantId: alert.plantId || null,
    deviceId: alert.deviceId || null,
    severity: fields.severity,
    status: { $in: ["RESOLVED", "CANCELLED"] }
  })
    .sort({ createdAt: -1 })
    .select("_id recurrenceCount")
    .lean();

  // The 24h window travels with the ticket. Best-effort: a summary that cannot
  // be built is not a reason to refuse to raise the work order.
  let metricsWindow = null;
  if (alert.deviceId || alert.plantId) {
    try {
      metricsWindow = await summariseWindow({
        deviceRef: alert.deviceId || null,
        plantId: alert.plantId || null,
        at: alert.createdAt || new Date()
      });
    } catch (err) {
      console.error("Could not summarise the metrics window:", err?.message || err);
    }
  }

  const task = await MaintenanceTask.create({
    ...fields,
    metricsWindow,
    previousTicketId: previous?._id || null,
    recurrenceCount: previous ? (previous.recurrenceCount || 0) + 1 : 0,
    diagnostics: diagnostics || [],
    checklist: (checklist || []).map((item) =>
      typeof item === "string" ? { label: item, done: false } : { ...item, done: false }
    )
  });

  await Alert.updateOne({ _id: alert._id }, { ticketId: task._id });
  alert.ticketId = task._id;

  await logAudit({
    event: "ticket.opened",
    req,
    actorUserId: openedBy,
    targetType: "TASK",
    targetId: task._id,
    meta: {
      raisedByAlert: String(alert._id),
      alertType: alert.type,
      severity: task.severity,
      ownerRole: task.ownerRole,
      triageDueAt: task.triageDueAt,
      reason,
      previousTicketId: task.previousTicketId ? String(task.previousTicketId) : null,
      recurrenceCount: task.recurrenceCount
    }
  });

  socketEmit("task:updated", { task });
  return task;
}

/**
 * Guarantees an alert has somewhere for its work to live.
 *
 * Reuses the live ticket when there is one — reassigning an alert must not open
 * a second work order for the same fault. A ticket that has already closed
 * while the alert stayed live means the condition outlived the response, so a
 * fresh linked ticket is opened rather than reviving a finished one.
 */
async function ensureTicketForAlert(alert, { actorUserId = null, req = null, reason = null } = {}) {
  if (alert.ticketId) {
    const existing = await MaintenanceTask.findById(alert.ticketId);
    if (existing && LIVE_TICKET_STATUSES.includes(existing.status)) {
      return { ticket: existing, created: false };
    }
  }

  const ticket = await openTicketForAlert(alert, {}, {
    force: true,
    openedBy: actorUserId,
    req,
    reason
  });
  return { ticket, created: !!ticket };
}

/**
 * Raises the public advisory for a confirmed quality breach.
 *
 * This is the one thing the system does immediately and by itself, because the
 * public cannot wait for someone to drive to the site. It does NOT touch
 * operationalStatus — the plant is still physically open, and saying otherwise
 * would be false. Both facts are true at once and each gets its own field.
 */
async function setAdvisory(alert, context = {}) {
  if (alert.type !== "QUALITY_UNSAFE" || !alert.plantId) return;

  const reason = context.parameters
    ? `Water quality breach: ${context.parameters}`
    : "Water quality breach detected";

  await Plant.updateOne(
    { _id: alert.plantId },
    { advisory: { active: true, since: new Date(), reason, alertId: alert._id } }
  );

  await logAudit({
    event: "plant.advisory_raised",
    targetType: "PLANT",
    targetId: alert.plantId,
    meta: { reason, alertId: String(alert._id) }
  });

  socketEmit("plant:advisory", {
    plantId: String(alert.plantId),
    active: true,
    reason
  });
}

/** Lifts the advisory once the incident behind it is closed out. */
async function clearAdvisory(plantId, { actorUserId = null, reason = null } = {}) {
  const plant = await Plant.findById(plantId).select("advisory").lean();
  if (!plant?.advisory?.active) return false;

  await Plant.updateOne(
    { _id: plantId },
    { advisory: { active: false, since: null, reason: null, alertId: null } }
  );

  await logAudit({
    event: "plant.advisory_lifted",
    actorUserId,
    targetType: "PLANT",
    targetId: plantId,
    meta: { reason }
  });

  socketEmit("plant:advisory", { plantId: String(plantId), active: false, reason: null });
  return true;
}

/**
 * The monitored condition stopped. Closes matching live alerts, except those
 * whose type requires human review, or those with work still open against them.
 *
 * Replaces the bare `Alert.updateMany({ status: 'RESOLVED' })` calls, which
 * closed alerts with no actor, no reason and no audit trail.
 */
async function clearAlerts({
  type,
  plantId = null,
  deviceId = null,
  inventoryItemId = null,
  reason = null
}) {
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

    // An alert with live work against it does not close just because the
    // symptom stopped. A device that came back up still needs the visit that
    // was dispatched for it, and auto-closing here would hide that the work is
    // open and strand the maintainer holding it.
    const hasLiveWork = alert.ticketId
      ? await MaintenanceTask.exists({
          _id: alert.ticketId,
          status: { $in: LIVE_TICKET_STATUSES }
        })
      : null;

    if (needsReview || hasLiveWork) {
      alert.status = "CLEARED_PENDING_REVIEW";
      pendingReview += 1;
    } else {
      alert.status = "RESOLVED";
      alert.resolvedAt = now;
      cleared += 1;
    }
    await alert.save();

    await logAudit({
      event:
        alert.status === "CLEARED_PENDING_REVIEW"
          ? "alert.cleared_pending_review"
          : "alert.auto_resolved",
      targetType: "ALERT",
      targetId: alert._id,
      meta: {
        type,
        reason,
        heldOpenBy: hasLiveWork ? String(alert.ticketId) : null,
        ...scopeOf(alert)
      }
    });

    socketEmit("alert:updated", { alert });
  }

  return { cleared, pendingReview };
}

/**
 * The primary way an alert is answered: hand it to a person.
 *
 * Opens the work order if the alert has none, routes it to the chosen assignee
 * with the dispatch note as their instruction, and moves the alert to ACK. The
 * alert deliberately does NOT close here — it closes when the work is finished,
 * which is the only moment anyone can honestly say the problem went away.
 */
async function dispatchAlert({ alertId, assignedToUserId, note = null, user, req = null }) {
  const alert = await Alert.findById(alertId);
  if (!alert) return { error: "NOT_FOUND" };
  if (alert.status === "RESOLVED") return { error: "ALREADY_RESOLVED" };

  // Assigning by hand is a deliberate act, so it opens a ticket even for a type
  // that never raises one by itself.
  const { ticket, created } = await ensureTicketForAlert(alert, {
    actorUserId: user._id,
    req,
    reason: "alert assigned to a person"
  });
  if (!ticket) return { error: "NO_TICKET" };

  const result = await assignTicket({
    task: ticket,
    assignedToUserId,
    actorUserId: user._id,
    req,
    note
  });
  if (result.error) return result;

  const previousStatus = alert.status;
  if (alert.status === "OPEN") {
    alert.status = "ACK";
    alert.ackAt = new Date();
    alert.ackByUserId = user._id;
  }
  alert.ticketId = ticket._id;
  await alert.save();

  await logAudit({
    event: "alert.dispatched",
    req,
    actorUserId: user._id,
    targetType: "ALERT",
    targetId: alert._id,
    meta: {
      type: alert.type,
      severity: alert.severity,
      previousStatus,
      ticketId: String(ticket._id),
      ticketCreated: created,
      assignedTo: result.assignee.display_name || result.assignee.email,
      role: result.assignee.role,
      note
    }
  });

  socketEmit("alert:updated", { alert });
  return { alert, ticket, assignee: result.assignee, ticketCreated: created };
}

/**
 * The work is finished, so the alert it came from is finished.
 *
 * This is what makes dispatch honest: the admin never has to come back and
 * close the alert by hand, and an alert cannot read as resolved while the work
 * behind it is still open.
 */
async function resolveAlertForTicket(task, { actorUserId = null, req = null, summary = null } = {}) {
  const alertId = task.externalRef && task.externalRef.type === "ALERT" ? task.externalRef.id : null;
  if (!alertId) return null;

  const alert = await Alert.findById(alertId);
  if (!alert || alert.status === "RESOLVED") return null;

  alert.status = "RESOLVED";
  alert.resolvedAt = new Date();
  alert.resolvedByUserId = actorUserId;
  await alert.save();

  await logAudit({
    event: "alert.resolved_by_ticket",
    req,
    actorUserId,
    targetType: "ALERT",
    targetId: alert._id,
    meta: {
      type: alert.type,
      severity: alert.severity,
      ticketId: String(task._id),
      note: summary
    }
  });

  socketEmit("alert:updated", { alert });
  return alert;
}

/**
 * Closing an alert by hand, without work being done — the escape hatch for a
 * false positive or a fault already fixed off-system.
 *
 * The note is mandatory and recorded. Any live work order is cancelled with the
 * same reason: closing the alert while leaving its ticket in a maintainer's
 * queue would send someone out to fix an incident that officially no longer exists.
 */
async function resolveAlert({ alertId, user, req = null, note = null }) {
  const alert = await Alert.findById(alertId);
  if (!alert) return { error: "NOT_FOUND" };
  if (alert.status === "RESOLVED") return { error: "ALREADY_RESOLVED" };

  let cancelledTicket = null;
  if (alert.ticketId) {
    const task = await MaintenanceTask.findById(alert.ticketId);
    if (task && LIVE_TICKET_STATUSES.includes(task.status)) {
      await cancelTicket({
        task,
        actorUserId: user._id,
        req,
        reason: `Alert closed without dispatch: ${note}`
      });
      cancelledTicket = task;
    }
  }

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
      cancelledTicketId: cancelledTicket ? String(cancelledTicket._id) : null,
      // Closing straight from OPEN means nobody acknowledged it first; worth
      // being able to query for.
      skippedAck: previousStatus === "OPEN"
    }
  });

  socketEmit("alert:updated", { alert });
  return { alert, cancelledTicket };
}

module.exports = {
  raiseAlert,
  openTicketForAlert,
  ensureTicketForAlert,
  contextForAlert,
  setAdvisory,
  clearAdvisory,
  clearAlerts,
  dispatchAlert,
  resolveAlert,
  resolveAlertForTicket,
  REQUIRES_HUMAN_REVIEW,
  LIVE_STATUSES
};
