/**
 * Groups audit events by what they are about, so the log reads as a set of
 * related stories rather than one undifferentiated stream.
 *
 * Category is derived from the event's namespace prefix rather than stored on
 * the row: events are named `noun.verb` by convention, so the prefix already
 * carries the answer and nothing has to be backfilled when a new event lands.
 */
const CATEGORIES = [
  { key: "auth", label: "Authentication", prefixes: ["auth."] },
  { key: "access", label: "Access & accounts", prefixes: ["admin.", "user."] },
  { key: "alerts", label: "Alerts", prefixes: ["alert."] },
  { key: "tickets", label: "Work orders", prefixes: ["ticket."] },
  { key: "devices", label: "Devices", prefixes: ["device."] },
  { key: "plants", label: "Plants", prefixes: ["plant."] }
];

const SYSTEM = { key: "system", label: "System", prefixes: [] };

function categoryOf(event) {
  const name = String(event || "");
  const hit = CATEGORIES.find((c) => c.prefixes.some((p) => name.startsWith(p)));
  return hit ? hit.key : SYSTEM.key;
}

/** Mongo filter for a category key, or null for "everything". */
function filterFor(categoryKey) {
  if (!categoryKey || categoryKey === "all") return null;

  const cat = CATEGORIES.find((c) => c.key === categoryKey);
  if (cat) {
    return { event: { $regex: `^(${cat.prefixes.map(escapeRegex).join("|")})` } };
  }
  if (categoryKey === SYSTEM.key) {
    // Anything that claims no namespace we recognise.
    const known = CATEGORIES.flatMap((c) => c.prefixes).map(escapeRegex).join("|");
    return { event: { $not: { $regex: `^(${known})` } } };
  }
  return null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { CATEGORIES, SYSTEM, categoryOf, filterFor };
