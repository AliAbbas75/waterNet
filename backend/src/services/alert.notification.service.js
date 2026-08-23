const { notify } = require("./notification.service");
const { categoryForAlertType } = require("./notificationCatalog");

const SEVERITY_LABEL = { CRITICAL: "CRITICAL", MAJOR: "Major", MINOR: "Minor", INFO: "Info" };
const TYPE_LABEL = {
  QUALITY_UNSAFE: "Water Quality Unsafe",
  DEVICE_OFFLINE: "Device Offline",
  DEVICE_FLAPPING: "Device Unstable",
  LOW_INVENTORY: "Low Inventory",
  AVAILABILITY_CHANGE: "Availability Change"
};

// Which roles are eligible for each alert type. This still decides who *may*
// hear about an alert; the user's own preference then decides whether they do,
// and on which channel.
const NOTIFY_ROLES = {
  QUALITY_UNSAFE: ["ADMIN", "SUPER_ADMIN", "MANAGER", "MAINTAINER"],
  DEVICE_OFFLINE: ["ADMIN", "SUPER_ADMIN", "MANAGER", "MAINTAINER"],
  DEVICE_FLAPPING: ["ADMIN", "SUPER_ADMIN", "MANAGER", "MAINTAINER"],
  AVAILABILITY_CHANGE: ["ADMIN", "SUPER_ADMIN", "MANAGER"],
  LOW_INVENTORY: ["ADMIN", "SUPER_ADMIN", "MANAGER"]
};

function buildTitle(alert) {
  const sev = SEVERITY_LABEL[alert.severity] || alert.severity;
  const type = TYPE_LABEL[alert.type] || alert.type;
  return `${type} · ${sev}`;
}

/**
 * Alerts now go out through the shared dispatcher rather than emailing every
 * eligible role unconditionally, so a user who has muted a category stops
 * hearing about it — and gains push on the categories they kept.
 */
async function notifyAdminsOfAlert(alert) {
  const category = categoryForAlertType(alert.type);
  if (!category) return;

  return notify({
    category,
    audience: { roles: NOTIFY_ROLES[alert.type] || ["ADMIN", "SUPER_ADMIN"] },
    title: buildTitle(alert),
    body: alert.message,
    url: "/admin/alerts",
    meta: { alertId: String(alert._id), type: alert.type, severity: alert.severity }
  });
}

module.exports = { notifyAdminsOfAlert, NOTIFY_ROLES, TYPE_LABEL };
