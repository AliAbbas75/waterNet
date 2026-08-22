const mongoose = require("mongoose");
const TelemetryReading = require("../models/TelemetryReading");

// `readings.totalLitres` from the IoT flow meter is a cumulative odometer: it
// only ever rises, and it counts every litre the device has passed since it was
// last reset. It is NOT the water left in the tank.
//
// Consumption over any window is therefore the *rise* in that odometer across
// the window, not the raw value:
//
//   consumed(window) = Σ max(0, totalLitres[n] - totalLitres[n-1])
//   tankRemaining    = capacity - consumed(since local midnight)
//
// Subtracting the raw odometer from capacity would read correctly only until a
// device had ever passed `capacity` litres in its lifetime, after which it would
// be permanently negative.

const DEFAULT_TANK_CAPACITY_LITRES = 1000;
// Half a tank. Expressed as a fraction so it stays meaningful at any capacity.
const DEFAULT_WARNING_FRACTION = 0.5;
// Plants are in Islamabad, so "resets at 12am" means midnight PKT, not UTC.
const DEFAULT_TIMEZONE = "Asia/Karachi";
const HISTORY_DAYS = 14;
// Ceiling on believable throughput, used to reject meter glitches. A device that
// reboots mid-day, or reports a corrupt odometer value, otherwise contributes a
// single enormous delta that swamps the day's real total.
const DEFAULT_MAX_FLOW_LITRES_PER_MIN = 30;

function timezone() {
  return process.env.CONSUMPTION_TIMEZONE || DEFAULT_TIMEZONE;
}

function maxFlowLitresPerMin() {
  const raw = Number(process.env.CONSUMPTION_MAX_FLOW_LPM);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_FLOW_LITRES_PER_MIN;
}

// Scales with the tank rather than being a fixed litre count. A fixed 500 L line
// meant any tank smaller than 500 L sat in WARNING even when completely full.
// At the default 1000 L capacity this still resolves to exactly 500 L.
function warningThreshold(capacity) {
  const raw = Number(process.env.CONSUMPTION_WARNING_FRACTION);
  const fraction = Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : DEFAULT_WARNING_FRACTION;
  return round(capacity * fraction);
}

// "YYYY-MM-DD" in the configured zone. en-CA formats in that order natively,
// which matches the $dateToString format used in the aggregation below.
function dayKey(date, tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

/**
 * Per-plant, per-day consumption derived from the odometer deltas.
 * One aggregation covers every requested plant so the plants list does not fan
 * out into N queries.
 *
 * @returns {Promise<Map<string, Array<{date: string, litres: number, lastReadingAt: Date}>>>}
 */
async function dailyBucketsByPlant(plantIds) {
  const ids = (plantIds || [])
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  if (!ids.length) return new Map();

  const tz = timezone();
  const maxFlow = maxFlowLitresPerMin();

  const rows = await TelemetryReading.aggregate([
    {
      $match: {
        plantId: { $in: ids },
        "readings.totalLitres": { $ne: null }
      }
    },
    // Partition by device, not by day: the delta that straddles midnight belongs
    // to the day of the later sample, and partitioning per day would discard it.
    {
      $setWindowFields: {
        partitionBy: { plantId: "$plantId", deviceId: "$deviceId" },
        sortBy: { timestamp: 1 },
        output: {
          previousTotal: { $shift: { output: "$readings.totalLitres", by: -1 } },
          previousTimestamp: { $shift: { output: "$timestamp", by: -1 } }
        }
      }
    },
    {
      $addFields: {
        rawDelta: {
          $switch: {
            branches: [
              // First ever sample for the device — no baseline to diff against.
              { case: { $eq: ["$previousTotal", null] }, then: 0 },
              {
                case: { $gte: ["$readings.totalLitres", "$previousTotal"] },
                then: { $subtract: ["$readings.totalLitres", "$previousTotal"] }
              }
            ],
            // A drop means the device rebooted and restarted its counter, so the
            // current reading is itself the volume passed since the reset.
            default: "$readings.totalLitres"
          }
        },
        elapsedMinutes: {
          $cond: [
            { $eq: ["$previousTimestamp", null] },
            0,
            {
              $divide: [{ $subtract: ["$timestamp", "$previousTimestamp"] }, 1000 * 60]
            }
          ]
        }
      }
    },
    {
      $addFields: {
        // No more water can pass in an interval than the pipe could carry. This
        // caps reboot artefacts and corrupt readings instead of letting a single
        // bad sample dominate the day.
        delta: { $min: ["$rawDelta", { $multiply: ["$elapsedMinutes", maxFlow] }] }
      }
    },
    {
      $group: {
        _id: {
          plantId: "$plantId",
          date: { $dateToString: { date: "$timestamp", format: "%Y-%m-%d", timezone: tz } }
        },
        litres: { $sum: "$delta" },
        lastReadingAt: { $max: "$timestamp" }
      }
    },
    { $sort: { "_id.date": 1 } }
  ]);

  const byPlant = new Map();
  for (const row of rows) {
    const key = String(row._id.plantId);
    if (!byPlant.has(key)) byPlant.set(key, []);
    byPlant.get(key).push({
      date: row._id.date,
      litres: round(row.litres),
      lastReadingAt: row.lastReadingAt
    });
  }
  return byPlant;
}

/**
 * Pure shaping of one plant's daily buckets into the metrics the UI renders.
 */
function summarize(plant, buckets = []) {
  const tz = timezone();

  const rawCapacity = Number(plant?.tankCapacityLitres);
  const capacity =
    Number.isFinite(rawCapacity) && rawCapacity > 0 ? rawCapacity : DEFAULT_TANK_CAPACITY_LITRES;
  const threshold = warningThreshold(capacity);

  const today = dayKey(new Date(), tz);
  const todayBucket = buckets.find((b) => b.date === today);
  const consumedToday = round(todayBucket?.litres || 0);

  // Today is still in progress; including it would drag the lifetime mean down.
  const completedDays = buckets.filter((b) => b.date !== today);
  const averageDailyConsumptionLitres = completedDays.length
    ? round(completedDays.reduce((sum, b) => sum + b.litres, 0) / completedDays.length)
    : null;

  // The tank is a buffer that is topped back up, not a one-shot daily allowance.
  // Daily throughput can legitimately exceed capacity — 600 L drawn from a 400 L
  // tank simply means it emptied and refilled once. Clamping the level at zero
  // instead (the previous behaviour) reported "600 L consumed" beside
  // "0 / 400 L remaining", which cannot both be true.
  const refillsToday = Math.floor(consumedToday / capacity);
  const drawnFromCurrentFill = consumedToday % capacity;
  // Landing exactly on a boundary means the tank just refilled, so it reads full.
  const tankRemainingLitres = round(
    drawnFromCurrentFill === 0 ? capacity : capacity - drawnFromCurrentFill
  );
  const percentRemaining = round((tankRemainingLitres / capacity) * 100, 1);

  const status = tankRemainingLitres < threshold ? "WARNING" : "OK";

  const lastReadingAt = buckets.reduce((latest, b) => {
    if (!b.lastReadingAt) return latest;
    return !latest || b.lastReadingAt > latest ? b.lastReadingAt : latest;
  }, null);

  return {
    date: today,
    timezone: tz,
    tankCapacityLitres: capacity,
    consumedTodayLitres: consumedToday,
    tankRemainingLitres,
    percentRemaining,
    // How many full tankfuls today's draw has already consumed. Non-zero means
    // the tank was topped up, which is what makes consumedToday > capacity valid.
    refillsToday,
    status,
    warningThresholdLitres: threshold,
    averageDailyConsumptionLitres,
    lifetimeConsumptionLitres: round(buckets.reduce((sum, b) => sum + b.litres, 0)),
    daysObserved: completedDays.length,
    hasData: buckets.length > 0,
    lastReadingAt,
    history: buckets.slice(-HISTORY_DAYS).map((b) => ({ date: b.date, litres: b.litres }))
  };
}

async function getPlantConsumption(plant) {
  const byPlant = await dailyBucketsByPlant([plant._id]);
  return summarize(plant, byPlant.get(String(plant._id)) || []);
}

/** Batched equivalent of getPlantConsumption for list views. */
async function getConsumptionForPlants(plants = []) {
  const byPlant = await dailyBucketsByPlant(plants.map((p) => p._id));
  const out = new Map();
  for (const plant of plants) {
    out.set(String(plant._id), summarize(plant, byPlant.get(String(plant._id)) || []));
  }
  return out;
}

module.exports = {
  getPlantConsumption,
  getConsumptionForPlants,
  dailyBucketsByPlant,
  summarize,
  DEFAULT_TANK_CAPACITY_LITRES,
  DEFAULT_WARNING_FRACTION
};
