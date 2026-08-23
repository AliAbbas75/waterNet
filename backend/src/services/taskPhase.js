/**
 * Six statuses, three phases a person actually thinks in.
 *
 * The statuses carry the detail the system needs — is it routed, is it stalled,
 * was it stood down. The phase answers the only question most people are asking
 * when they look at a queue: has this been started, and is it finished?
 *
 * CANCELLED is deliberately NOT folded into "completed". Work that was stood
 * down did not get done, and a board that counts it as done is lying about
 * throughput.
 */
const PHASE_STATUSES = {
  PENDING: ["TRIAGE", "ASSIGNED"],
  IN_PROGRESS: ["IN_PROGRESS", "BLOCKED"],
  COMPLETED: ["RESOLVED"],
  CANCELLED: ["CANCELLED"]
};

const STATUS_PHASE = Object.entries(PHASE_STATUSES).reduce((acc, [phase, statuses]) => {
  statuses.forEach((s) => {
    acc[s] = phase;
  });
  return acc;
}, {});

const PHASES = Object.keys(PHASE_STATUSES);

/**
 * The split anyone scanning a queue actually cares about first: is this still
 * somebody's problem, or is it done with?
 *
 * Derived from PHASE_STATUSES rather than listed again, so a status added to a
 * phase cannot quietly go missing from both sides of the split — which would
 * leave a work order that appears under no tab at all.
 */
const PHASE_GROUPS = {
  OPEN: [...PHASE_STATUSES.PENDING, ...PHASE_STATUSES.IN_PROGRESS],
  CLOSED: [...PHASE_STATUSES.COMPLETED, ...PHASE_STATUSES.CANCELLED]
};

/** Whether a status still needs someone to do something about it. */
function isOpenStatus(status) {
  return PHASE_GROUPS.OPEN.includes(status);
}

/** The phase a status belongs to, or null for a status this does not know. */
function phaseOf(status) {
  return STATUS_PHASE[status] || null;
}

/**
 * The statuses a phase covers, for querying. Accepts the two groups as well, so
 * a caller can ask for "open" without enumerating four statuses and getting it
 * subtly wrong.
 */
function statusesForPhase(phase) {
  const key = String(phase || "").toUpperCase();
  return PHASE_STATUSES[key] || PHASE_GROUPS[key] || null;
}

module.exports = {
  PHASES,
  PHASE_STATUSES,
  PHASE_GROUPS,
  STATUS_PHASE,
  phaseOf,
  statusesForPhase,
  isOpenStatus
};
