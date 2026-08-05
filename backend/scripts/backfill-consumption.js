/**
 * Backfills a plausible cumulative `readings.totalLitres` odometer onto historic
 * telemetry that predates flow metering, so the consumption metrics have
 * something to show for seeded plants.
 *
 * Only touches readings where totalLitres is missing, so real device data (which
 * carries its own odometer) is never overwritten.
 *
 * With --recent-days N it also synthesises telemetry for the last N days for any
 * installed device whose data has gone stale, so today's tank level and the
 * lifetime average have something to work with in a demo database.
 *
 * Usage: node scripts/backfill-consumption.js [--dry-run] [--recent-days N]
 */
const mongoose = require("mongoose");
require("dotenv").config();

const Plant = require("../src/models/Plant");
const Device = require("../src/models/Device");
const TelemetryReading = require("../src/models/TelemetryReading");

const DRY_RUN = process.argv.includes("--dry-run");
const TZ = process.env.CONSUMPTION_TIMEZONE || "Asia/Karachi";

const recentFlagIndex = process.argv.indexOf("--recent-days");
const RECENT_DAYS =
  recentFlagIndex !== -1 ? Math.max(1, Number(process.argv[recentFlagIndex + 1]) || 7) : 0;
// Match the live device cadence closely enough that the plausibility clamp in
// consumption.service.js never trims synthetic data.
const RECENT_STEP_MS = 30 * 60 * 1000;

// Target plant-level daily draw. Spans the 500 L warning line so the warning
// state is actually reachable in demo data instead of being theoretical.
const MIN_DAILY_LITRES = 240;
const MAX_DAILY_LITRES = 780;

function dayKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);
  console.log(`Connected. timezone=${TZ}${DRY_RUN ? " (dry run)" : ""}`);

  const plants = await Plant.find({});
  let totalUpdated = 0;

  for (const plant of plants) {
    const devices = await Device.find({ plantId: plant._id });
    if (!devices.length) continue;

    // Only readings still lacking an odometer value.
    const readings = await TelemetryReading.find({
      plantId: plant._id,
      readings: { $exists: true },
      "readings.totalLitres": null
    })
      .select({ _id: 1, deviceId: 1, timestamp: 1 })
      .sort({ timestamp: 1 });

    if (!readings.length) {
      console.log(`- ${plant.name}: nothing to backfill`);
      continue;
    }

    // Group by day so each day can be given a realistic total.
    const byDay = new Map();
    for (const r of readings) {
      const key = dayKey(r.timestamp);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(r);
    }

    // Each device carries its own monotonically rising odometer.
    const running = new Map();
    const ops = [];

    for (const [, dayReadings] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const dayTarget = rand(MIN_DAILY_LITRES, MAX_DAILY_LITRES);
      // Consumption accrues per reading; the first reading of a device only
      // establishes a baseline, so it contributes no delta.
      const perReading = dayTarget / Math.max(1, dayReadings.length);

      for (const r of dayReadings) {
        const key = String(r.deviceId);
        const previous = running.get(key);
        // Jitter keeps the series from looking synthetically linear.
        const next =
          previous === undefined ? 0 : previous + perReading * rand(0.55, 1.45);
        running.set(key, next);

        ops.push({
          updateOne: {
            filter: { _id: r._id },
            update: { $set: { "readings.totalLitres": Math.round(next * 1000) / 1000 } }
          }
        });
      }
    }

    if (!DRY_RUN && ops.length) {
      for (let i = 0; i < ops.length; i += 1000) {
        await TelemetryReading.bulkWrite(ops.slice(i, i + 1000));
      }
    }
    totalUpdated += ops.length;
    console.log(
      `- ${plant.name}: ${ops.length} readings across ${byDay.size} days, ${devices.length} device(s)`
    );
  }

  console.log(`${DRY_RUN ? "Would update" : "Updated"} ${totalUpdated} readings.`);

  if (RECENT_DAYS) await generateRecent(plants);

  await mongoose.disconnect();
}

/**
 * Synthesises the last RECENT_DAYS of telemetry for installed devices that have
 * no recent readings, so "consumed today" and the daily average are populated.
 * Devices already reporting (real hardware) are left alone.
 */
async function generateRecent(plants) {
  const now = Date.now();
  const since = new Date(now - RECENT_DAYS * 24 * 60 * 60 * 1000);
  const steps = Math.floor((RECENT_DAYS * 24 * 60 * 60 * 1000) / RECENT_STEP_MS);
  let inserted = 0;

  for (const plant of plants) {
    const devices = await Device.find({ plantId: plant._id, disabled: false, status: "INSTALLED" });
    if (!devices.length) continue;

    for (const device of devices) {
      const recentCount = await TelemetryReading.countDocuments({
        deviceId: device.deviceId,
        timestamp: { $gte: since }
      });
      if (recentCount > 0) continue; // live or already-fresh device

      // Continue the device's existing odometer rather than restarting it,
      // otherwise the join looks like a counter reset.
      const last = await TelemetryReading.findOne({
        deviceId: device.deviceId,
        "readings.totalLitres": { $ne: null }
      }).sort({ timestamp: -1 });

      let odometer = last?.readings?.totalLitres || 0;
      const docs = [];
      // ~48 readings/day at this cadence; 3-12 L per step lands near 350 L/day.
      for (let i = steps; i >= 0; i--) {
        const ts = new Date(now - i * RECENT_STEP_MS);
        odometer += rand(3, 12);
        docs.push({
          deviceRef: device._id,
          deviceId: device.deviceId,
          plantId: plant._id,
          timestamp: ts,
          readings: {
            pH: rand(6.9, 7.7),
            turbidity: rand(0.2, 0.9),
            TDS: rand(180, 340),
            flowRate: rand(6, 18),
            totalLitres: Math.round(odometer * 1000) / 1000
          },
          ingestMeta: { schemaVersion: "1.0", protocol: "MQTT" }
        });
      }

      if (!DRY_RUN && docs.length) {
        await TelemetryReading.insertMany(docs, { ordered: false });
      }
      inserted += docs.length;
      console.log(`  + ${plant.name} / ${device.deviceId}: ${docs.length} synthetic readings`);
    }
  }

  console.log(
    `${DRY_RUN ? "Would insert" : "Inserted"} ${inserted} recent readings across ${RECENT_DAYS} days.`
  );
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
