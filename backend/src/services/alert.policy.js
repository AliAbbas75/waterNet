/**
 * One table decides everything an alert does: how severe it is, whether it
 * raises a ticket, how long triage may take, and what closing it requires.
 *
 * Adding an alert type later means adding a row here rather than editing
 * branches scattered across the MQTT service, the analysis controller and the
 * inventory service — which is how the behaviour drifted apart in the first place.
 */

// Minutes an unassigned ticket may sit in TRIAGE before it is overdue.
const TRIAGE_MINUTES = {
  CRITICAL: 15,
  MAJOR: 240, // 4 hours
  MINOR: 2880, // 2 days
  INFO: null
};

const POLICY = {
  QUALITY_UNSAFE: {
    severity: "CRITICAL",
    raisesTicket: true,
    // Closing a plant is physical work. The system never flips
    // operationalStatus itself — it asks a person to go and do it, and the
    // status follows from the completed checklist.
    checklist: [
      // Completing this is what closes the plant. The effect is declared here
      // rather than matched on the label, so wording can change without
      // silently detaching the behaviour.
      { label: "Plant physically closed to the public", effect: "CLOSE_PLANT" },
      { label: "Public advisory issued" },
      { label: "Sample taken for laboratory confirmation" },
      { label: "Source of contamination identified" }
    ],
    title: (ctx) => `Water quality unsafe — ${ctx.plantName || "plant"}`,
    description: (ctx) =>
      `Readings breached safe limits${ctx.parameters ? ` on ${ctx.parameters}` : ""}. ` +
      `Close the plant to the public and work through the safety checklist. ` +
      `Do not resolve until the readings are confirmed safe by an independent sample.`
  },

  DEVICE_FLAPPING: {
    severity: "MAJOR",
    raisesTicket: true,
    title: (ctx) => `Device unstable — ${ctx.deviceName || "device"}`,
    description: (ctx) =>
      `${ctx.deviceName || "The device"} is cycling between online and offline. ` +
      `It is reporting intermittently rather than being cleanly down, which usually ` +
      `means a power or connectivity fault at the installation.`
  },

  DEVICE_OFFLINE: {
    severity: "MAJOR",
    raisesTicket: true,
    title: (ctx) => `Device offline — ${ctx.deviceName || "device"}`,
    description: (ctx) =>
      `${ctx.deviceName || "The device"} has stopped reporting, so this plant is ` +
      `no longer being monitored. Water quality cannot be verified while it is down.`
  },

  LOW_INVENTORY: {
    severity: "MINOR",
    raisesTicket: false // stock is chased through the inventory view, not a work order
  },

  // An admin closing a plant is an intended action, not an incident. Raising a
  // CRITICAL alert for it trained people to ignore the queue.
  AVAILABILITY_CHANGE: {
    severity: "INFO",
    raisesTicket: false
  }
};

function policyFor(type) {
  return POLICY[type] || { severity: "INFO", raisesTicket: false };
}

/** Severity from the policy table, so call sites cannot disagree with it. */
function severityFor(type) {
  return policyFor(type).severity;
}

function triageDueAt(severity, from = new Date()) {
  const minutes = TRIAGE_MINUTES[severity];
  if (!minutes) return null;
  return new Date(from.getTime() + minutes * 60 * 1000);
}

/** Builds the ticket payload for an alert, or null when the type raises none. */
function ticketForAlert(alert, ctx = {}) {
  const policy = policyFor(alert.type);
  if (!policy.raisesTicket) return null;

  const severity = policy.severity;
  const raisedAt = alert.createdAt || new Date();

  return {
    title: policy.title ? policy.title(ctx) : alert.message,
    description: policy.description ? policy.description(ctx) : alert.message,
    status: "TRIAGE",
    origin: "SYSTEM",
    severity,
    triageDueAt: triageDueAt(severity, raisedAtSafe(raisedAt)),
    plantId: alert.plantId || null,
    deviceId: alert.deviceId || null,
    externalRef: { type: "ALERT", id: alert._id },
    checklist: policy.checklist || null
  };
}

// createdAt is absent until mongoose has written the doc; fall back to now.
function raisedAtSafe(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

module.exports = { POLICY, TRIAGE_MINUTES, policyFor, severityFor, triageDueAt, ticketForAlert };
