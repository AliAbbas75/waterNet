/**
 * Backfills MaintenanceTask.ownerRole on tickets written before the field
 * existed.
 *
 * Schema defaults only apply to new documents, so without this every existing
 * ticket reads as MAINTAINER-owned — which would put restocking work in front
 * of a maintainer and offer the wrong people first in the assignee picker.
 *
 * The rule mirrors the live one: the role that already holds the ticket owns it;
 * an unassigned system ticket takes its owner from the alert policy; anything
 * else falls back to MAINTAINER, which is what field work is.
 *
 *   docker exec waternet-backend node scripts/migrate-ticket-owner-role.js
 */
const mongoose = require("mongoose");
require("dotenv").config();

const MaintenanceTask = require("../src/models/MaintenanceTask");
const Alert = require("../src/models/Alert");
const User = require("../src/models/User");
const { ownerRoleFor } = require("../src/services/alert.policy");

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  const pending = await MaintenanceTask.find({
    $or: [{ ownerRole: { $exists: false } }, { ownerRole: null }]
  });
  console.log(`${pending.length} ticket(s) without an owner role`);

  const counts = { ADMIN: 0, MAINTAINER: 0 };

  for (const task of pending) {
    let ownerRole = null;

    if (task.assignedToUserId) {
      const assignee = await User.findById(task.assignedToUserId).select("role").lean();
      if (assignee) ownerRole = assignee.role === "MAINTAINER" ? "MAINTAINER" : "ADMIN";
    }

    if (!ownerRole && task.externalRef && task.externalRef.type === "ALERT") {
      const alert = await Alert.findById(task.externalRef.id).select("type").lean();
      if (alert) ownerRole = ownerRoleFor(alert.type);
    }

    ownerRole = ownerRole || "MAINTAINER";
    await MaintenanceTask.updateOne({ _id: task._id }, { ownerRole });
    counts[ownerRole] += 1;
  }

  console.log(`  ADMIN: ${counts.ADMIN}`);
  console.log(`  MAINTAINER: ${counts.MAINTAINER}`);

  const remaining = await MaintenanceTask.countDocuments({ ownerRole: { $exists: false } });
  console.log(remaining === 0 ? "done — every ticket has an owner role" : `WARNING: ${remaining} left`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
