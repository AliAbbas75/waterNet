/**
 * Six statuses, three phases a person actually thinks in.
 *
 * Mirrors frontend/src/components/ui/TaskStatus.jsx and
 * backend/src/services/taskPhase.js — if the mapping changes, it changes in all
 * three, because a task that reads "pending" on the web and "assigned" on a
 * phone is two different answers to the same question.
 *
 * CANCELLED is deliberately its own phase rather than folded into completed:
 * work that was stood down did not get done.
 */
export const TASK_STATUS = {
  TRIAGE: { phase: "PENDING", label: "Pending", detail: "needs routing", tone: "WARN" },
  ASSIGNED: { phase: "PENDING", label: "Pending", detail: "not started", tone: "ASSIGNED" },
  IN_PROGRESS: { phase: "IN_PROGRESS", label: "In progress", detail: null, tone: "INFO" },
  BLOCKED: { phase: "IN_PROGRESS", label: "In progress", detail: "held up", tone: "UNSAFE" },
  RESOLVED: { phase: "COMPLETED", label: "Completed", detail: null, tone: "RESOLVED" },
  CANCELLED: { phase: "CANCELLED", label: "Cancelled", detail: null, tone: "NEUTRAL" }
};

export const PHASE_ORDER = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export const PHASE_LABEL = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

export function taskStatusMeta(status) {
  return (
    TASK_STATUS[status] || {
      phase: null,
      label: String(status || "unknown").replace(/_/g, " "),
      detail: null,
      tone: "NEUTRAL"
    }
  );
}

export function taskPhase(status) {
  return taskStatusMeta(status).phase;
}

/** Counts by phase, for the header stats. */
export function countByPhase(tasks) {
  const out = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 };
  (tasks || []).forEach((t) => {
    const phase = taskPhase(t.status);
    if (out[phase] !== undefined) out[phase] += 1;
  });
  return out;
}
