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
    title: (ctx) => `Device offline — ${ctx.deviceName || "device"}`,
    description: (ctx) =>
      `${ctx.deviceName || "The device"} has stopped reporting, so this plant is ` +
      `no longer being monitored. Water quality cannot be verified while it is down.`
  },

  LOW_INVENTORY: {
    // Stock alerts fire in bulk when a delivery is late, so they do not each
    // raise a work order the moment they are detected. Acknowledging one is a
    // person saying "I am dealing with this", and that is what opens the ticket.
    severity: "MINOR",
    raisesTicket: false,
    // Restocking is procurement, not a site visit: it stays with an admin.
    ownerRole: "ADMIN",
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
    // Acknowledging this records that a decision already carried out has been
    // seen. There is no outstanding work, so manufacturing a work order for it
    // would fill the queue with tickets that are complete before they open.
    // An admin who does want work from it can still assign one explicitly.
    ticketOnAck: false,
    ownerRole: "ADMIN"
  }
};

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

/**
 * Whether acknowledging this type should open a work order. Default is yes:
 * an alert a person has taken on is work, and work needs somewhere to live.
 */
function opensTicketOnAck(type) {
  return policyFor(type).ticketOnAck !== false;
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
    checklist: policy.checklist || null
  };
}

// createdAt is absent until mongoose has written the doc; fall back to now.
function raisedAtSafe(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

module.exports = {
  POLICY,
  TRIAGE_MINUTES,
  policyFor,
  severityFor,
  ownerRoleFor,
  opensTicketOnAck,
  triageDueAt,
  ticketForAlert
};
