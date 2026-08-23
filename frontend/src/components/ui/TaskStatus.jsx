import { Badge } from "./Badge.jsx";

/**
 * Six statuses, three phases a person actually thinks in.
 *
 * The status carries the detail the system needs — is it routed, is it stalled,
 * was it stood down. The phase answers the question anyone scanning a queue is
 * really asking: has this been started, and is it finished?
 *
 * Kept in step with backend/src/services/taskPhase.js, which resolves the same
 * mapping for querying.
 */
export const TASK_STATUS = {
  TRIAGE: {
    phase: "PENDING",
    label: "Pending",
    detail: "needs routing",
    variant: "warn"
  },
  ASSIGNED: {
    phase: "PENDING",
    label: "Pending",
    detail: "not started",
    variant: "brand"
  },
  IN_PROGRESS: {
    phase: "IN_PROGRESS",
    label: "In progress",
    detail: null,
    variant: "info"
  },
  BLOCKED: {
    phase: "IN_PROGRESS",
    label: "In progress",
    detail: "blocked",
    variant: "unsafe"
  },
  RESOLVED: {
    phase: "COMPLETED",
    label: "Completed",
    detail: null,
    variant: "safe"
  },
  // Deliberately its own phase rather than folded into Completed: work that was
  // stood down did not get done, and a board that counts it as done is lying
  // about how much got finished.
  CANCELLED: {
    phase: "CANCELLED",
    label: "Cancelled",
    detail: null,
    variant: "muted"
  }
};

export const PHASE_ORDER = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export const PHASE_LABEL = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  OPEN: "Open",
  CLOSED: "Closed"
};

/**
 * The first split anyone scanning the board makes: is this still somebody's
 * problem, or is it done with? Mirrors PHASE_GROUPS in
 * backend/src/services/taskPhase.js, which resolves the same two words to the
 * same statuses when querying.
 */
export const OPEN_PHASES = ["PENDING", "IN_PROGRESS"];
export const CLOSED_PHASES = ["COMPLETED", "CANCELLED"];

/** Whether a status still needs someone to do something about it. */
export function isOpenStatus(status) {
  return OPEN_PHASES.includes(taskPhase(status));
}

export function taskStatusMeta(status) {
  return (
    TASK_STATUS[status] || {
      phase: null,
      label: String(status || "unknown").replace(/_/g, " "),
      detail: null,
      variant: "neutral"
    }
  );
}

export function taskPhase(status) {
  return taskStatusMeta(status).phase;
}

/**
 * The tag itself. Shows the phase, and the status underneath it only when the
 * status says something the phase does not — "pending" and "pending, blocked
 * on parts" are different situations to the person who has to chase it.
 */
export function TaskStatusTag({ status, blockedReason, className, showDetail = true }) {
  const meta = taskStatusMeta(status);
  return (
    <span className={"inline-flex flex-col items-start gap-0.5 " + (className || "")}>
      <Badge variant={meta.variant} dot>
        {meta.label}
      </Badge>
      {showDetail && meta.detail ? (
        <span className="text-[11px] text-slate-500" title={blockedReason || undefined}>
          {meta.detail}
        </span>
      ) : null}
    </span>
  );
}
