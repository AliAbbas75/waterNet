/**
 * Backfills MaintenanceTask.startedAt and blockedReason on tasks written before
 * the lifecycle was tracked.
 *
 * Schema defaults only apply to new documents, so without this every existing
 * in-progress and finished task claims it was never started, and the "held up"
 * tasks show no reason even though the reason was written to their log at the
 * time. Neither is true — the information exists, it just was not on the task.
 *
 *   docker exec waternet-backend node scripts/migrate-task-lifecycle.js
 */
const mongoose = require("mongoose");
require("dotenv").config();

const MaintenanceTask = require("../src/models/MaintenanceTask");
const MaintenanceLog = require("../src/models/MaintenanceLog");

// Anything past ASSIGNED was, by definition, started at some point.
const STARTED_STATUSES = ["IN_PROGRESS", "BLOCKED", "RESOLVED", "CANCELLED"];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  // ---------------------------------------------------------------- startedAt
  const needStart = await MaintenanceTask.find({
    status: { $in: STARTED_STATUSES },
    $or: [{ startedAt: { $exists: false } }, { startedAt: null }]
  }).select("_id status assignedAt createdAt resolvedAt");

  console.log(`${needStart.length} task(s) with no start time`);

  let fromAssigned = 0;
  let fromCreated = 0;
  for (const task of needStart) {
    // assignedAt is the closest honest answer: work cannot begin before it is
    // handed over. Falling back to createdAt for the handful with neither.
    const startedAt = task.assignedAt || task.createdAt;
    if (!startedAt) continue;
    if (task.assignedAt) fromAssigned += 1;
    else fromCreated += 1;
    await MaintenanceTask.updateOne({ _id: task._id }, { startedAt });
  }
  console.log(`  from assignedAt: ${fromAssigned}`);
  console.log(`  from createdAt:  ${fromCreated}`);

  // ------------------------------------------------------------ blockedReason
  const blocked = await MaintenanceTask.find({
    status: "BLOCKED",
    $or: [{ blockedReason: { $exists: false } }, { blockedReason: null }]
  }).select("_id");

  console.log(`${blocked.length} held-up task(s) with no reason on the task`);

  let recovered = 0;
  for (const task of blocked) {
    // The reason was written to the task log when it stopped; lift it onto the
    // task so the queue can show it without opening every ticket.
    const log = await MaintenanceLog.findOne({
      taskId: task._id,
      note: { $regex: /^Blocked:/i }
    })
      .sort({ createdAt: -1 })
      .select("note")
      .lean();
    if (!log) continue;
    const reason = log.note.replace(/^Blocked:\s*/i, "").trim();
    if (!reason) continue;
    await MaintenanceTask.updateOne({ _id: task._id }, { blockedReason: reason });
    recovered += 1;
  }
  console.log(`  recovered from the task log: ${recovered}`);

  const remaining = await MaintenanceTask.countDocuments({
    status: { $in: STARTED_STATUSES },
    startedAt: null
  });
  console.log(remaining === 0 ? "done — every started task has a start time" : `WARNING: ${remaining} left`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
