/**
 * What the system can notify about, who may receive each thing, and what a
 * user gets before they have expressed any preference.
 *
 * One table so a category cannot mean different things in the dispatcher, the
 * preferences API and the settings screen. Adding a notification means adding
 * a row here rather than editing three places that then drift.
 */

const CHANNELS = ["push", "email"];

const CATEGORIES = {
  WATER_QUALITY: {
    label: "Water quality",
    description: "Readings outside safe limits, and public advisories.",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "MAINTAINER", "PUBLIC"],
    // Unsafe water is the one thing nobody should have to opt into.
    defaults: { push: true, email: true }
  },
  DEVICE_HEALTH: {
    label: "Device health",
    description: "Sensors that stop reporting or start flapping.",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "MAINTAINER"],
    defaults: { push: true, email: false }
  },
  PLANT_AVAILABILITY: {
    label: "Plant availability",
    description: "A plant closing, reopening, or entering maintenance.",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "MAINTAINER", "PUBLIC"],
    defaults: { push: true, email: false }
  },
  WORK_ORDERS: {
    label: "Work orders",
    description: "Tickets assigned to you, and changes to ones you hold.",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "MAINTAINER"],
    defaults: { push: true, email: false }
  },
  INVENTORY: {
    label: "Inventory",
    description: "Stock dropping below its reorder threshold.",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    defaults: { push: false, email: false }
  },
  ISSUE_REPORTS: {
    label: "Public issue reports",
    description: "Problems reported by the public, and replies to yours.",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "PUBLIC"],
    defaults: { push: false, email: false }
  }
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

// Alert types map onto categories; the alert ladder stays the alert ladder.
const ALERT_TYPE_CATEGORY = {
  QUALITY_UNSAFE: "WATER_QUALITY",
  DEVICE_OFFLINE: "DEVICE_HEALTH",
  DEVICE_FLAPPING: "DEVICE_HEALTH",
  AVAILABILITY_CHANGE: "PLANT_AVAILABILITY",
  LOW_INVENTORY: "INVENTORY"
};

function categoryForAlertType(type) {
  return ALERT_TYPE_CATEGORY[type] || null;
}

function isValidCategory(key) {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, key);
}

/** Categories a role may receive at all. Preference cannot widen this. */
function categoriesForRole(role) {
  return CATEGORY_KEYS.filter((key) => CATEGORIES[key].roles.includes(role));
}

function isEligible(role, category) {
  return isValidCategory(category) && CATEGORIES[category].roles.includes(role);
}

/**
 * The user's effective settings: catalog defaults for everything their role can
 * receive, overlaid with whatever they have actually chosen. Categories their
 * role cannot receive are absent rather than false, so the UI never offers a
 * switch that the dispatcher would ignore.
 */
function effectivePreferences(user) {
  const stored = user?.notificationPrefs || {};
  const out = {};
  for (const key of categoriesForRole(user?.role)) {
    const saved = typeof stored.get === "function" ? stored.get(key) : stored[key];
    out[key] = {
      push: saved?.push ?? CATEGORIES[key].defaults.push,
      email: saved?.email ?? CATEGORIES[key].defaults.email
    };
  }
  return out;
}

function wants(user, category, channel) {
  if (!isEligible(user?.role, category)) return false;
  const prefs = effectivePreferences(user);
  return Boolean(prefs[category]?.[channel]);
}

/** Catalog shaped for the settings screen, filtered to what this role sees. */
function catalogForRole(role) {
  return categoriesForRole(role).map((key) => ({
    key,
    label: CATEGORIES[key].label,
    description: CATEGORIES[key].description,
    defaults: CATEGORIES[key].defaults
  }));
}

module.exports = {
  CHANNELS,
  CATEGORIES,
  CATEGORY_KEYS,
  categoryForAlertType,
  isValidCategory,
  categoriesForRole,
  isEligible,
  effectivePreferences,
  wants,
  catalogForRole
};
