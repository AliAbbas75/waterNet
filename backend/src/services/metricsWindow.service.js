const TelemetryReading = require("../models/TelemetryReading");
const ThresholdConfig = require("../models/ThresholdConfig");

/**
 * A day of readings, summarised onto the work order.
 *
 * A maintainer opening a ticket needs the shape of the data, not one number:
 * "turbidity spiked at 04:00 and never came back" and "turbidity has read the
 * same value for a day" are different faults with the same breach value, and
 * only a series tells them apart.
 *
 * Raw readings are not stored — a device reporting every 5 seconds produces
 * ~17,000 rows a day, and a work order is not a data warehouse. It is bucketed
 * into hours, which is small enough to embed, survives the device going offline
 * afterwards, and is a record of what the data looked like WHEN the alert fired
 * rather than whenever somebody gets round to reading it.
 */

const PARAMETERS = [
  { key: "pH", label: "pH", unit: "" },
  { key: "turbidity", label: "Turbidity", unit: "NTU" },
  { key: "TDS", label: "TDS", unit: "ppm" },
  { key: "flowRate", label: "Flow rate", unit: "L/min" }
];

const WINDOW_HOURS = 24;

/**
 * Stuck, meaning most readings are literally the same number.
 *
 * Counting distinct values rather than measuring spread, because spread gets
 * this exactly wrong in both directions: one glitch reading inflates the
 * deviation of a probe pinned at 100 enough to hide it, while a genuinely
 * healthy pH sitting in a narrow band looks suspiciously tight. A day of real
 * measurement produces hundreds of distinct values; a dead probe produces one,
 * or one plus the odd spike.
 */
function isFlat(distinctCount, readingCount) {
  if (!distinctCount || !readingCount) return false;
  if (distinctCount === 1) return true;
  return distinctCount / readingCount < 0.01;
}

function round(value, dp = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/**
 * Thresholds that applied to this plant, so the summary can say whether a value
 * was actually out of range rather than leaving the reader to remember limits.
 * A per-plant override wins over the global row, matching the analysis path.
 */
async function thresholdsFor(plantId) {
  const rows = await ThresholdConfig.find({
    $or: [{ plantId: null }, ...(plantId ? [{ plantId }] : [])]
  }).lean();

  const map = {};
  for (const row of rows) {
    if (!row.plantId) map[row.parameter] = row;
  }
  for (const row of rows) {
    if (row.plantId) map[row.parameter] = row;
  }
  return map;
}

/**
 * Builds the window. Scoped to one device when the alert names one, otherwise
 * to every device at the plant — a quality breach is a fact about the water,
 * not about whichever probe happened to notice.
 */
async function summariseWindow({ deviceRef = null, deviceId = null, plantId = null, at = new Date() } = {}) {
  const to = at instanceof Date ? at : new Date(at);
  const from = new Date(to.getTime() - WINDOW_HOURS * 60 * 60 * 1000);

  const scope = [];
  if (deviceRef) scope.push({ deviceRef });
  if (deviceId) scope.push({ deviceId });
  if (!scope.length && plantId) scope.push({ plantId });
  if (!scope.length) return null;

  const match = { timestamp: { $gte: from, $lte: to }, $or: scope };

  const [totals] = await TelemetryReading.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        ...PARAMETERS.reduce((acc, p) => {
          acc[`${p.key}_min`] = { $min: `$readings.${p.key}` };
          acc[`${p.key}_max`] = { $max: `$readings.${p.key}` };
          acc[`${p.key}_avg`] = { $avg: `$readings.${p.key}` };
          acc[`${p.key}_last`] = { $last: `$readings.${p.key}` };
          // Rounded before de-duplicating so float noise in the last decimal
          // does not read as a sensor that is actually moving.
          acc[`${p.key}_values`] = { $addToSet: { $round: [`$readings.${p.key}`, 2] } };
          return acc;
        }, {})
      }
    },
    {
      // Only the count of distinct values leaves the database. The sets
      // themselves can hold thousands of entries for a healthy channel and
      // none of that belongs on a work order.
      $project: {
        count: 1,
        ...PARAMETERS.reduce((acc, p) => {
          acc[`${p.key}_min`] = 1;
          acc[`${p.key}_max`] = 1;
          acc[`${p.key}_avg`] = 1;
          acc[`${p.key}_last`] = 1;
          acc[`${p.key}_distinct`] = { $size: `$${p.key}_values` };
          return acc;
        }, {})
      }
    }
  ]);

  // Nothing reported in the window. Worth returning explicitly rather than
  // null: "no telemetry for 24 hours" is itself the most useful thing the
  // ticket can tell somebody about an offline device.
  if (!totals || !totals.count) {
    return {
      windowHours: WINDOW_HOURS,
      from,
      to,
      readingCount: 0,
      parameters: [],
      series: [],
      note: "No telemetry in this window"
    };
  }

  const buckets = await TelemetryReading.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { date: "$timestamp", format: "%Y-%m-%dT%H:00:00Z", timezone: "UTC" }
        },
        n: { $sum: 1 },
        ...PARAMETERS.reduce((acc, p) => {
          acc[p.key] = { $avg: `$readings.${p.key}` };
          return acc;
        }, {})
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const thresholds = await thresholdsFor(plantId);

  const parameters = PARAMETERS.map((p) => {
    const min = totals[`${p.key}_min`];
    const max = totals[`${p.key}_max`];
    if (min === null || min === undefined) return null;

    const limit = thresholds[p.key];
    const breached =
      limit && (min < limit.safeMin || max > limit.safeMax) ? true : limit ? false : null;

    return {
      key: p.key,
      label: p.label,
      unit: p.unit,
      min: round(min),
      max: round(max),
      avg: round(totals[`${p.key}_avg`]),
      latest: round(totals[`${p.key}_last`]),
      // A channel that barely moved across a whole day is a stuck sensor, and
      // saying so saves a wasted site visit chasing a reading that was never
      // real. Measured by spread relative to the value, not min === max: one
      // stray sample is enough to defeat an exact comparison, and a probe
      // pinned at 100 with a single glitch reading is still pinned at 100.
      flat: isFlat(totals[`${p.key}_distinct`], totals.count),
      distinctValues: totals[`${p.key}_distinct`],
      safeMin: limit ? limit.safeMin : null,
      safeMax: limit ? limit.safeMax : null,
      breached
    };
  }).filter(Boolean);

  const series = buckets.map((b) => ({
    ts: b._id,
    n: b.n,
    ...PARAMETERS.reduce((acc, p) => {
      acc[p.key] = round(b[p.key]);
      return acc;
    }, {})
  }));

  return {
    windowHours: WINDOW_HOURS,
    from,
    to,
    readingCount: totals.count,
    parameters,
    series,
    note: null
  };
}

module.exports = { summariseWindow, PARAMETERS, WINDOW_HOURS };
