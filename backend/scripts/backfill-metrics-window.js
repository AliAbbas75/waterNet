/**
 * Attaches the 24-hour window to work orders raised before anything attached one.
 *
 * The window was only ever written when an alert opened a ticket, so manual
 * jobs and everything predating that feature reach a maintainer with no reading
 * history at all — which is most of the board.
 *
 * Each window is anchored to when its work order was RAISED, not to now. That
 * is what makes backfilling honest: it reconstructs the evidence that existed
 * at the time from telemetry still on record, rather than recording today's
 * readings against an incident from last week. A ticket raised before the
 * retention window simply gets an empty summary saying so.
 *
 * Only fills what is missing, so it is safe to re-run.
 *
 *   node scripts/backfill-metrics-window.js          # report only
 *   node scripts/backfill-metrics-window.js --apply  # write
 */

require("dotenv").config();
const mongoose = require("mongoose");

const MaintenanceTask = require("../src/models/MaintenanceTask");
require("../src/models/Plant");
require("../src/models/Device");
const { summariseWindow } = require("../src/services/metricsWindow.service");

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 25000 });
  console.log(APPLY ? "Applying changes.\n" : "Dry run — pass --apply to write.\n");

  // A window needs something to summarise: a ticket with neither a plant nor a
  // device has no readings to describe, and an empty one would just be noise.
  const candidates = await MaintenanceTask.find({
    $and: [
      { $or: [{ metricsWindow: null }, { metricsWindow: { $exists: false } }] },
      { $or: [{ plantId: { $ne: null } }, { deviceId: { $ne: null } }] }
    ]
  }).select("_id title createdAt plantId deviceId status assignedToUserId");

  console.log(`${candidates.length} work order(s) without a window\n`);
  if (!candidates.length) {
    await mongoose.disconnect();
    return;
  }

  let filled = 0;
  let empty = 0;
  let failed = 0;

  for (const task of candidates) {
    let window = null;
    try {
      window = await summariseWindow({
        deviceRef: task.deviceId || null,
        plantId: task.plantId || null,
        at: task.createdAt || new Date()
      });
    } catch (err) {
      failed += 1;
      console.log(`  FAILED  ${task.title} — ${err.message}`);
      continue;
    }

    if (!window) {
      failed += 1;
      continue;
    }

    if (window.readingCount) filled += 1;
    else empty += 1;

    const detail = window.readingCount
      ? `${window.readingCount} readings, ${window.series.length} buckets`
      : "no telemetry in that window";
    console.log(`  ${window.readingCount ? "FILLED " : "EMPTY  "} ${task.title} — ${detail}`);

    if (APPLY) {
      await MaintenanceTask.updateOne({ _id: task._id }, { $set: { metricsWindow: window } });
    }
  }

  console.log(
    `\n${filled} with readings, ${empty} with none to report, ${failed} could not be summarised.`
  );
  if (!APPLY) console.log("Nothing was written.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
