/**
 * Phase 3 migration.
 *
 * Sets Device.expectedIntervalSeconds from each device's own observed reporting
 * cadence, measured as the median gap between its recent telemetry readings.
 *
 * Without this every device falls back to the 60s default, and offline
 * detection would immediately flag the fleet's 30-minute sensors — the exact
 * misfire a flat grace period causes. Measured on this database:
 *
 *     ESP32-de5e        3s      (real hardware)
 *     WN-0001 … WN-0014 1800s   (30 minutes)
 *
 * The median is used rather than the mean so a single long gap — a restart, a
 * network drop — does not inflate the interval and blind the device to real
 * outages.
 *
 * Usage: node scripts/migrate-device-intervals.js [--dry-run] [--samples N]
 */
const mongoose = require("mongoose");
require("dotenv").config();

const Device = require("../src/models/Device");
const TelemetryReading = require("../src/models/TelemetryReading");

const DRY_RUN = process.argv.includes("--dry-run");
const sampleFlag = process.argv.indexOf("--samples");
const SAMPLES = sampleFlag !== -1 ? Math.max(5, Number(process.argv[sampleFlag + 1]) || 40) : 40;

const DEFAULT_INTERVAL = 60;
// Guard rails: sub-second cadences make the grace period meaninglessly tight,
// and anything beyond an hour means an outage would go unnoticed for half a day.
const MIN_INTERVAL = 5;
const MAX_INTERVAL = 3600;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);

  const devices = await Device.find({}).select("deviceId expectedIntervalSeconds");
  console.log(`${devices.length} devices; sampling last ${SAMPLES} readings each\n`);

  let updated = 0;
  let skipped = 0;

  for (const device of devices) {
    const readings = await TelemetryReading.find({ deviceId: device.deviceId })
      .select("timestamp")
      .sort({ timestamp: -1 })
      .limit(SAMPLES)
      .lean();

    if (readings.length < 3) {
      console.log(`  ${device.deviceId.padEnd(16)} too few readings — leaving at ${device.expectedIntervalSeconds ?? DEFAULT_INTERVAL}s`);
      skipped += 1;
      continue;
    }

    const gaps = [];
    for (let i = 1; i < readings.length; i += 1) {
      const gap = (readings[i - 1].timestamp - readings[i].timestamp) / 1000;
      if (gap > 0) gaps.push(gap);
    }

    const observed = median(gaps);
    if (!observed) {
      skipped += 1;
      continue;
    }

    const interval = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Math.round(observed)));
    const grace = Math.max(60, interval * 3);

    console.log(
      `  ${device.deviceId.padEnd(16)} observed ${String(Math.round(observed)).padStart(5)}s ` +
      `-> interval ${String(interval).padStart(5)}s (grace ${grace}s)`
    );

    if (!DRY_RUN) {
      await Device.updateOne({ _id: device._id }, { expectedIntervalSeconds: interval });
      updated += 1;
    }
  }

  console.log(
    `\n${DRY_RUN ? "Would update" : "Updated"} ${DRY_RUN ? devices.length - skipped : updated} device(s); ${skipped} skipped.`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
