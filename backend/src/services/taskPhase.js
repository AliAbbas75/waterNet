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

/** The phase a status belongs to, or null for a status this does not know. */
function phaseOf(status) {
  return STATUS_PHASE[status] || null;
}

/** The statuses a phase covers, for querying. */
function statusesForPhase(phase) {
  return PHASE_STATUSES[String(phase || "").toUpperCase()] || null;
}

module.exports = { PHASES, PHASE_STATUSES, STATUS_PHASE, phaseOf, statusesForPhase };
