const WaterQualityState = require("../models/WaterQualityState");

/**
 * Whether a plant's water is inside its configured limits, for list views.
 *
 * WaterQualityState already holds the per-device verdict that evaluateQuality
 * wrote against this plant's thresholds, so health is read from there rather
 * than re-deriving it from raw telemetry. That keeps one answer in the system:
 * the plants list, the plant page and the alert feed cannot disagree.
 */

// A reading that is merely WARNING has still left safeMin..safeMax. The ladder
// records how far out it went, not whether it went out, so both rungs count as
// out of range here.
const OUT_OF_RANGE = new Set(["WARNING", "UNSAFE"]);

function summarize(states = []) {
  const reporting = states.filter((s) => s.category && s.category !== "NO_DATA");
  if (!reporting.length) {
    return { status: "NO_DATA", devicesReporting: 0, breaches: [] };
  }

  // Every parameter that left its safe band, on any device at the plant.
  const breaches = [];
  for (const state of reporting) {
    for (const reason of state.reasons || []) {
      if (!reason.threshold || reason.threshold === "safe") continue;
      breaches.push({
        parameter: reason.parameter,
        value: reason.value ?? null,
        severity: reason.threshold === "unsafe" ? "UNSAFE" : "WARNING",
        deviceName: state.deviceId?.deviceId || null
      });
    }
  }

  const unhealthy = reporting.some((s) => OUT_OF_RANGE.has(s.category)) || breaches.length > 0;

  return {
    status: unhealthy ? "UNHEALTHY" : "HEALTHY",
    devicesReporting: reporting.length,
    breaches
  };
}

/** One query for the whole list, so the plants table does not fan out per row. */
async function getWaterHealthForPlants(plants = []) {
  const ids = plants.map((p) => p._id);
  const out = new Map();
  if (!ids.length) return out;

  const states = await WaterQualityState.find({ plantId: { $in: ids } })
    .populate("deviceId", "deviceId")
    .lean();

  const byPlant = new Map();
  for (const state of states) {
    const key = String(state.plantId);
    if (!byPlant.has(key)) byPlant.set(key, []);
    byPlant.get(key).push(state);
  }

  for (const plant of plants) {
    const key = String(plant._id);
    out.set(key, summarize(byPlant.get(key) || []));
  }
  return out;
}

module.exports = { getWaterHealthForPlants, summarize, OUT_OF_RANGE };
