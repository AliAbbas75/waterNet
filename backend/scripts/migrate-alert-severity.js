/**
 * Phase 2 migration.
 *
 *  1. Alert.severity  WARN -> MAJOR. The ladder gained MINOR and MAJOR so there
 *     is room between "needs attention today" and "monitoring is blind".
 *  2. Backfills MaintenanceTask.severity and .origin on tasks created before
 *     those fields existed. Mongoose defaults only apply to new documents, so
 *     without this every existing task reads back undefined.
 *
 * Goes through the raw collections deliberately: a model-level query cannot
 * match rows holding a value the enum no longer admits.
 *
 * Usage: node scripts/migrate-alert-severity.js [--dry-run] [--rollback]
 */
const mongoose = require("mongoose");
require("dotenv").config();

const DRY_RUN = process.argv.includes("--dry-run");
const ROLLBACK = process.argv.includes("--rollback");

const FROM = ROLLBACK ? "MAJOR" : "WARN";
const TO = ROLLBACK ? "WARN" : "MAJOR";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);

  const alerts = mongoose.connection.collection("alerts");
  const tasks = mongoose.connection.collection("maintenancetasks");

  // --- 1. severity rename -------------------------------------------------
  const affected = await alerts.countDocuments({ severity: FROM });
  console.log(`Alert.severity ${FROM} -> ${TO}: ${affected} document(s)`);

  if (affected && !DRY_RUN) {
    const res = await alerts.updateMany({ severity: FROM }, { $set: { severity: TO } });
    console.log(`  updated ${res.modifiedCount}`);
    const left = await alerts.countDocuments({ severity: FROM });
    if (left) throw new Error(`${left} alert(s) still hold "${FROM}"`);
  }

  // --- 2. backfill task fields -------------------------------------------
  if (!ROLLBACK) {
    const missingSeverity = await tasks.countDocuments({ severity: { $exists: false } });
    const missingOrigin = await tasks.countDocuments({ origin: { $exists: false } });
    console.log(`MaintenanceTask backfill: severity=${missingSeverity}, origin=${missingOrigin}`);

    if (!DRY_RUN) {
      if (missingSeverity) {
        await tasks.updateMany({ severity: { $exists: false } }, { $set: { severity: "MINOR" } });
      }
      if (missingOrigin) {
        // Everything that predates the bridge was created by a person.
        await tasks.updateMany({ origin: { $exists: false } }, { $set: { origin: "MANUAL" } });
      }
      console.log("  backfilled");
    }
  }

  console.log(DRY_RUN ? "\nDry run — nothing written." : "\nDone.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
