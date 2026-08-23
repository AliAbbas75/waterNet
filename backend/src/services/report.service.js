const mongoose = require("mongoose");
const TelemetryReading = require("../models/TelemetryReading");
const ThresholdConfig = require("../models/ThresholdConfig");
const Plant = require("../models/Plant");

const METRICS = [
  { key: "pH", label: "pH", unit: "" },
  { key: "turbidity", label: "Turbidity", unit: "NTU" },
  { key: "TDS", label: "TDS", unit: "ppm" },
  { key: "flowRate", label: "Flow rate", unit: "L/min" }
];

const DAY = 24 * 60 * 60 * 1000;

// Hourly buckets over a day keep the chart readable; anything longer would run
// to hundreds of points, so those fall back to daily.
const RANGES = {
  "24h": { label: "Last 24 hours", ms: DAY, bucket: "hour" },
  "7d": { label: "Last 7 days", ms: 7 * DAY, bucket: "day" },
  "30d": { label: "Last 30 days", ms: 30 * DAY, bucket: "day" },
  "365d": { label: "Last 365 days", ms: 365 * DAY, bucket: "day" }
};

const MODES = new Set(["aggregate", "individual", "comparison"]);

function resolveRange(key) {
  const range = RANGES[key] || RANGES["7d"];
  const to = new Date();
  return {
    key: RANGES[key] ? key : "7d",
    label: range.label,
    bucket: range.bucket,
    from: new Date(to.getTime() - range.ms),
    to
  };
}

function bucketKey(bucket) {
  const base = {
    y: { $year: "$timestamp" },
    m: { $month: "$timestamp" },
    d: { $dayOfMonth: "$timestamp" }
  };
  return bucket === "hour" ? { ...base, h: { $hour: "$timestamp" } } : base;
}

// Thresholds are per plant and parameter, falling back to a global row with a
// null plantId. Resolved up front so the aggregation can bake the limits in.
async function loadThresholds(plantIds) {
  const rows = await ThresholdConfig.find({
    $or: [{ plantId: null }, { plantId: { $in: plantIds } }]
  }).lean();

  const global = {};
  const perPlant = new Map();
  for (const row of rows) {
    if (!row.plantId) {
      global[row.parameter] = row;
      continue;
    }
    const key = String(row.plantId);
    if (!perPlant.has(key)) perPlant.set(key, {});
    perPlant.get(key)[row.parameter] = row;
  }
  return { global, perPlant };
}

// A reading breaches when it falls outside its safe band. Plants may override
// the global band, so this compiles to a $switch on plantId rather than a
// single comparison. Non-numeric readings are excluded first: BSON orders null
// below every number, so a bare $lt would score every gap as a breach.
function breachExpr(metricKey, thresholds) {
  const value = `$readings.${metricKey}`;
  const outside = (t) => ({
    $or: [{ $lt: [value, t.safeMin] }, { $gt: [value, t.safeMax] }]
  });

  const branches = [];
  for (const [plantId, params] of thresholds.perPlant) {
    const t = params[metricKey];
    if (!t) continue;
    branches.push({
      case: { $eq: ["$plantId", new mongoose.Types.ObjectId(plantId)] },
      then: outside(t)
    });
  }

  const fallback = thresholds.global[metricKey] ? outside(thresholds.global[metricKey]) : false;
  const breached = branches.length ? { $switch: { branches, default: fallback } } : fallback;

  return { $cond: [{ $isNumber: value }, breached, false] };
}

function statAccumulators(thresholds) {
  const acc = {};
  for (const { key } of METRICS) {
    const value = `$readings.${key}`;
    acc[`${key}__mean`] = { $avg: value };
    acc[`${key}__min`] = { $min: value };
    acc[`${key}__max`] = { $max: value };
    acc[`${key}__n`] = { $sum: { $cond: [{ $isNumber: value }, 1, 0] } };
    acc[`${key}__breach`] = { $sum: { $cond: [breachExpr(key, thresholds), 1, 0] } };
  }
  return acc;
}

function seriesAccumulators() {
  const acc = { ts: { $min: "$timestamp" }, count: { $sum: 1 } };
  for (const { key } of METRICS) acc[key] = { $avg: `$readings.${key}` };
  return acc;
}

// Turns one aggregation row into the per-metric shape the documents render.
function shapeStats(row, thresholds, plantId) {
  const limits = (plantId && thresholds.perPlant.get(String(plantId))) || {};
  const out = {};
  for (const metric of METRICS) {
    const n = row?.[`${metric.key}__n`] || 0;
    const breaches = row?.[`${metric.key}__breach`] || 0;
    const threshold = limits[metric.key] || thresholds.global[metric.key] || null;
    out[metric.key] = {
      mean: n ? row[`${metric.key}__mean`] : null,
      min: n ? row[`${metric.key}__min`] : null,
      max: n ? row[`${metric.key}__max`] : null,
      count: n,
      breaches,
      breachPct: n ? Math.round((breaches / n) * 1000) / 10 : null,
      threshold: threshold ? { safeMin: threshold.safeMin, safeMax: threshold.safeMax } : null
    };
  }
  return out;
}

/**
 * Water-quality statistics for a set of plants over a time range.
 *
 * `mode` decides what the caller needs rather than how much we query:
 *   aggregate  — one combined figure across every selected plant
 *   individual — each plant on its own
 *   comparison — each plant, intended to be read side by side
 *
 * Statistics come from the raw readings, not from the charted buckets, so a
 * min or max is the real extreme rather than the smallest bucket average.
 */
async function buildQualityReport({ plantIds = [], rangeKey = "7d", mode = "aggregate" } = {}) {
  const range = resolveRange(rangeKey);
  const reportMode = MODES.has(mode) ? mode : "aggregate";

  const ids = plantIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const plants = await Plant.find(ids.length ? { _id: { $in: ids } } : {})
    .select("name address operationalStatus")
    .sort({ name: 1 })
    .lean();

  const scopeIds = plants.map((p) => p._id);
  const thresholds = await loadThresholds(scopeIds);

  const match = {
    timestamp: { $gte: range.from, $lte: range.to },
    readings: { $exists: true, $ne: null }
  };
  // An empty selection means the whole network; scoping to an empty $in would
  // instead match nothing and silently produce a blank report.
  if (ids.length) match.plantId = { $in: scopeIds };

  const wantsPerPlant = reportMode !== "aggregate";

  const [overallRows, perPlantRows, seriesRows] = await Promise.all([
    TelemetryReading.aggregate([{ $match: match }, { $group: { _id: null, ...statAccumulators(thresholds) } }]),
    TelemetryReading.aggregate([
      { $match: match },
      { $group: { _id: "$plantId", ...statAccumulators(thresholds) } }
    ]),
    TelemetryReading.aggregate([
      { $match: match },
      {
        $group: {
          _id: wantsPerPlant
            ? { p: "$plantId", ...bucketKey(range.bucket) }
            : bucketKey(range.bucket),
          ...seriesAccumulators()
        }
      },
      { $sort: { ts: 1 } }
    ])
  ]);

  const statsByPlant = new Map(perPlantRows.map((r) => [String(r._id), r]));
  const seriesByPlant = new Map();
  const combinedSeries = [];

  for (const row of seriesRows) {
    const point = { ts: row.ts, count: row.count };
    for (const { key } of METRICS) point[key] = row[key];
    if (!wantsPerPlant) {
      combinedSeries.push(point);
      continue;
    }
    const key = String(row._id.p);
    if (!seriesByPlant.has(key)) seriesByPlant.set(key, []);
    seriesByPlant.get(key).push(point);
  }

  const perPlant = plants.map((plant) => ({
    plant: { id: plant._id, name: plant.name, address: plant.address },
    stats: shapeStats(statsByPlant.get(String(plant._id)), thresholds, plant._id),
    series: seriesByPlant.get(String(plant._id)) || []
  }));

  return {
    generatedAt: new Date(),
    mode: reportMode,
    range: { key: range.key, label: range.label, bucket: range.bucket, from: range.from, to: range.to },
    scope: {
      allPlants: ids.length === 0,
      plantCount: plants.length,
      plants: plants.map((p) => ({ id: p._id, name: p.name }))
    },
    metrics: METRICS,
    aggregate: {
      stats: shapeStats(overallRows[0], thresholds, null),
      series: combinedSeries
    },
    perPlant
  };
}

module.exports = { buildQualityReport, METRICS, RANGES, MODES };
