/**
 * One table decides everything an alert does: how severe it is, whether it
 * raises a ticket, WHO that ticket belongs to, how long triage may take, and
 * what closing it requires.
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
    // Field work: someone drives to the plant, closes it, takes a sample.
    ownerRole: "MAINTAINER",
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
    ownerRole: "MAINTAINER",
    // An intermittent fault is diagnosed differently from a dead one: the
    // device is reachable, so the questions are about power and signal quality
    // rather than whether anyone can get to it.
    checklist: [
      { label: "Power supply and cabling checked at the cabinet" },
      { label: "Signal strength recorded at the installation" },
      { label: "Connector and antenna reseated" },
      { label: "Device observed stable for 30 minutes before leaving" }
    ],
    title: (ctx) => `Device unstable — ${ctx.deviceName || "device"}`,
    description: (ctx) =>
      `${ctx.deviceName || "The device"} is cycling between online and offline. ` +
      `It is reporting intermittently rather than being cleanly down, which usually ` +
      `means a power or connectivity fault at the installation.`
  },

  DEVICE_OFFLINE: {
    severity: "MAJOR",
    raisesTicket: true,
    ownerRole: "MAINTAINER",
    // The plant is unmonitored until this is closed, so the last step is
    // explicitly about confirming readings resumed — not merely that a light
    // came back on.
    checklist: [
      { label: "Power at the installation confirmed" },
      { label: "Device physically inspected for damage or tampering" },
      { label: "Network or SIM connectivity verified on site" },
      { label: "Live telemetry confirmed arriving after the fix" }
    ],
    title: (ctx) => `Device offline — ${ctx.deviceName || "device"}`,
    description: (ctx) =>
      `${ctx.deviceName || "The device"} has stopped reporting, so this plant is ` +
      `no longer being monitored. Water quality cannot be verified while it is down.`
  },

  LOW_INVENTORY: {
    // Stock alerts fire in bulk when a delivery is late, so they do not each
    // raise a work order the moment they are detected. One is opened when an
    // admin assigns the alert to whoever is going to chase the delivery.
    severity: "MINOR",
    raisesTicket: false,
    // Restocking is procurement, not a site visit: it belongs to a manager.
    ownerRole: "MANAGER",
    checklist: [
      { label: "Purchase order raised with the supplier" },
      { label: "Delivery date confirmed in writing" },
      { label: "Stock received and counted in" }
    ],
    title: (ctx) => `Restock — ${ctx.itemName || "inventory item"}`,
    description: (ctx) =>
      `${ctx.itemName || "This item"} has fallen to or below its reorder point. ` +
      `Raise a purchase order and record the delivery against this ticket so the ` +
      `stock level and the paperwork stay in step.`
  },

  // An admin closing a plant is an intended action, not an incident. Raising a
  // CRITICAL alert for it trained people to ignore the queue.
  AVAILABILITY_CHANGE: {
    severity: "INFO",
    raisesTicket: false,
    // Records a decision that has already been carried out, so nothing is
    // raised for it automatically. An admin who does want follow-up work can
    // still assign it, which opens a ticket like any other.
    ownerRole: "MANAGER"
  }
};

/**
 * The evidence a maintainer needs on the work order itself.
 *
 * Each entry is whatever the detection path already knew at the moment it
 * raised the alert. It is captured onto the ticket rather than looked up later,
 * because "last seen 40 minutes ago" is only meaningful next to the time the
 * alert fired — by the time someone opens the ticket, a live lookup answers a
 * different question.
 */
const DIAGNOSTICS = {
  QUALITY_UNSAFE: (ctx) => [
    ["Breached parameters", ctx.parameters],
    ["Readings at breach", ctx.readings],
    ["Consecutive unsafe readings", ctx.consecutiveUnsafe],
    ["Reporting device", ctx.deviceName],
    ["Thresholds applied", ctx.thresholds]
  ],
  DEVICE_OFFLINE: (ctx) => [
    ["Device", ctx.deviceName],
    ["Last reported", ctx.lastSeenAt],
    ["Silent for", ctx.silentFor],
    ["Expected reporting interval", ctx.expectedInterval],
    ["Grace period allowed", ctx.gracePeriod]
  ],
  DEVICE_FLAPPING: (ctx) => [
    ["Device", ctx.deviceName],
    ["Availability changes", ctx.flips],
    ["Observed over", ctx.flapWindow],
    ["Unstable since", ctx.flappingSince],
    ["Last reported", ctx.lastSeenAt]
  ],
  LOW_INVENTORY: (ctx) => [
    ["Item", ctx.itemName],
    ["Quantity on hand", ctx.quantity],
    ["Reorder point", ctx.reorderThreshold]
  ]
};

/**
 * Builds the diagnostic snapshot for an alert, dropping anything the detection
 * path could not supply. Everything is stringified: this is a record of what
 * was true, not a value anything computes against later.
 */
function diagnosticsFor(type, ctx = {}) {
  const build = DIAGNOSTICS[type];
  if (!build) return [];
  return build(ctx)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value]) => ({ label, value: String(value) }));
}

function policyFor(type) {
  return POLICY[type] || { severity: "INFO", raisesTicket: false, ownerRole: "ADMIN" };
}

/** Severity from the policy table, so call sites cannot disagree with it. */
function severityFor(type) {
  return policyFor(type).severity;
}

/** Which role the work belongs to — "the nature of the alert", made explicit. */
function ownerRoleFor(type) {
  return policyFor(type).ownerRole || "MAINTAINER";
}

function triageDueAt(severity, from = new Date()) {
  const minutes = TRIAGE_MINUTES[severity];
  if (!minutes) return null;
  return new Date(from.getTime() + minutes * 60 * 1000);
}

/**
 * Builds the ticket payload for an alert, or null when the type raises none.
 *
 * `force` opens a ticket for a type that does not raise one automatically —
 * used when a person acknowledges or assigns the alert by hand, which is a
 * deliberate act rather than a detection.
 */
function ticketForAlert(alert, ctx = {}, { force = false } = {}) {
  const policy = policyFor(alert.type);
  if (!policy.raisesTicket && !force) return null;

  const severity = policy.severity;
  const raisedAt = alert.createdAt || new Date();

  return {
    title: policy.title ? policy.title(ctx) : alert.message,
    description: policy.description ? policy.description(ctx) : alert.message,
    status: "TRIAGE",
    origin: "SYSTEM",
    severity,
    ownerRole: policy.ownerRole || "MAINTAINER",
    triageDueAt: triageDueAt(severity, raisedAtSafe(raisedAt)),
    plantId: alert.plantId || null,
    deviceId: alert.deviceId || null,
    externalRef: { type: "ALERT", id: alert._id },
    checklist: policy.checklist || null,
    diagnostics: diagnosticsFor(alert.type, ctx)
  };
}

// createdAt is absent until mongoose has written the doc; fall back to now.
function raisedAtSafe(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

module.exports = {
  POLICY,
  DIAGNOSTICS,
  diagnosticsFor,
  TRIAGE_MINUTES,
  policyFor,
  severityFor,
  ownerRoleFor,
  triageDueAt,
  ticketForAlert
};
