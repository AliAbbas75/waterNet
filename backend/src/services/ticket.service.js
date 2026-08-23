const MaintenanceLog = require("../models/MaintenanceLog");
const User = require("../models/User");
const { logAudit } = require("./audit.service");
const { emit: socketEmit } = require("./socket.service");

// Roles that can hold a work order. PUBLIC obviously cannot; SUPER_ADMIN can,
// but assigning the top account routine field work is almost always a mistake,
// so it is not offered as a target.
const ASSIGNABLE_ROLES = ["MAINTAINER", "MANAGER", "ADMIN"];

// Anything that is not finished. A ticket in one of these still owes someone work.
const LIVE_TICKET_STATUSES = ["TRIAGE", "ASSIGNED", "IN_PROGRESS", "BLOCKED"];

/**
 * Routes a ticket to a person. Single path on purpose: assignment happens from
 * the maintenance board AND from the alert list, and two copies of this would
 * drift until one of them stopped writing the audit entry.
 *
 * Returns { task, assignee, wasTriage } or { error }.
 */
async function assignTicket({ task, assignedToUserId, actorUserId, req = null, note = null }) {
  const assignee = await User.findById(assignedToUserId).select("role display_name email active");
  if (!assignee || !ASSIGNABLE_ROLES.includes(assignee.role)) {
    return { error: "INVALID_ASSIGNEE" };
  }
  if (assignee.active === false) {
    return { error: "INACTIVE_ASSIGNEE" };
  }

  const wasTriage = task.status === "TRIAGE";
  const previousAssigneeId = task.assignedToUserId ? String(task.assignedToUserId) : null;

  task.assignedToUserId = assignee._id;
  task.assignedByUserId = actorUserId;
  task.assignedAt = new Date();

  // Routing a system-raised ticket out of TRIAGE is the moment a person takes
  // it on. Record who did it and whether they beat the deadline, because an
  // unassigned critical ticket is itself an incident.
  if (wasTriage) {
    task.status = "ASSIGNED";
    task.triagedByUserId = actorUserId;
    task.triagedAt = new Date();
  }

  await task.save();

  // The dispatch note is the instruction the assignee opens the ticket to read,
  // so it belongs on the ticket's own log and not only in the audit trail.
  if (note) {
    await MaintenanceLog.create({
      taskId: task._id,
      authorUserId: actorUserId,
      note,
      structuredFields: {
        type: "DISPATCH",
        toUserId: assignee._id,
        fromUserId: previousAssigneeId
      }
    });
  }

  await logAudit({
    event: wasTriage ? "ticket.triaged" : "ticket.reassigned",
    req,
    actorUserId,
    targetType: "TASK",
    targetId: task._id,
    meta: {
      assignedTo: assignee.display_name || assignee.email,
      assignedToUserId: String(assignee._id),
      role: assignee.role,
      severity: task.severity,
      origin: task.origin,
      note,
      previousAssigneeId,
      overdue: task.triageDueAt ? new Date() > task.triageDueAt : null
    }
  });

  socketEmit("task:updated", { task });
  return { task, assignee, wasTriage };
}

/**
 * Cancels a ticket nobody is going to work — used when an alert is closed by
 * hand while its work order is still open. Leaving the ticket behind would put
 * a live task in a maintainer's queue for an incident that no longer exists.
 */
async function cancelTicket({ task, actorUserId, req = null, reason }) {
  if (!LIVE_TICKET_STATUSES.includes(task.status)) return { task, cancelled: false };

  const previousStatus = task.status;
  task.status = "CANCELLED";
  task.resolvedAt = new Date();
  task.resolvedByUserId = actorUserId;
  task.resolutionSummary = reason;
  await task.save();

  await MaintenanceLog.create({
    taskId: task._id,
    authorUserId: actorUserId,
    note: `Cancelled: ${reason}`,
    structuredFields: { type: "CANCELLED", previousStatus }
  });

  await logAudit({
    event: "ticket.cancelled",
    req,
    actorUserId,
    targetType: "TASK",
    targetId: task._id,
    meta: { previousStatus, reason, severity: task.severity }
  });

  socketEmit("task:updated", { task });
  return { task, cancelled: true };
}

module.exports = { assignTicket, cancelTicket, ASSIGNABLE_ROLES, LIVE_TICKET_STATUSES };
