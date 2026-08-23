/**
 * Brings stored severities back in line with the policy table.
 *
 * Severity used to be decided at each call site, so rows written before the
 * policy existed still carry whatever that site chose: inventory alerts sitting
 * at MAJOR, and an admin closing a plant recorded as CRITICAL. The policy is
 * the only opinion the system should have, and a queue where a restock outranks
 * a device outage teaches people to ignore the ordering.
 *
 * Idempotent: it writes only rows that disagree with the policy, so a second
 * run reports nothing to do. Safe to run against live data.
 *
 *   node scripts/reconcile-alert-severity.js          # report only
 *   node scripts/reconcile-alert-severity.js --apply  # write
 */

require("dotenv").config();
const mongoose = require("mongoose");

const Alert = require("../src/models/Alert");
const MaintenanceTask = require("../src/models/MaintenanceTask");
const { severityFor, triageDueAt } = require("../src/services/alert.policy");

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  console.log(APPLY ? "Applying changes.\n" : "Dry run — pass --apply to write.\n");

  const alerts = await Alert.find({}, "type severity").lean();

  const wrong = alerts
    .map((a) => ({ ...a, want: severityFor(a.type) }))
    .filter((a) => a.want && a.severity !== a.want);

  if (!wrong.length) {
    console.log("Every alert already matches the policy. Nothing to do.");
  } else {
    const grouped = wrong.reduce((acc, a) => {
      const key = `${a.type}: ${a.severity} -> ${a.want}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    for (const [line, n] of Object.entries(grouped)) console.log(`  ${line}  (${n})`);

    if (APPLY) {
      for (const a of wrong) {
        await Alert.updateOne({ _id: a._id }, { $set: { severity: a.want } });
      }
      console.log(`\nUpdated ${wrong.length} alert(s).`);
    }
  }

  // The ticket mirrors the alert that raised it, and its triage deadline is
  // derived from that severity — so leaving the ticket behind would put a
  // restock back at the top of the queue by a different route.
  const alertIds = new Set(wrong.map((a) => String(a._id)));
  const tasks = await MaintenanceTask.find(
    { "externalRef.type": "ALERT" },
    "externalRef severity status createdAt triageDueAt"
  ).lean();

  const staleTasks = tasks.filter((t) => alertIds.has(String(t.externalRef?.id)));
  const byId = new Map(wrong.map((a) => [String(a._id), a.want]));

  const taskChanges = staleTasks
    .map((t) => ({ t, want: byId.get(String(t.externalRef.id)) }))
    .filter(({ t, want }) => want && t.severity !== want);

  if (!taskChanges.length) {
    console.log("\nNo work orders need their severity changed.");
  } else {
    console.log(`\n${taskChanges.length} work order(s) to follow their alert:`);
    for (const { t, want } of taskChanges) {
      console.log(`  ${t.severity} -> ${want}  (${t.status})`);
    }
    if (APPLY) {
      for (const { t, want } of taskChanges) {
        const update = { severity: want };
        // Only a ticket still awaiting triage has a deadline worth recomputing.
        // Rewriting it on finished work would invent a deadline that never
        // applied and quietly rewrite what the audit trail says happened.
        if (t.status === "TRIAGE") {
          update.triageDueAt = triageDueAt(want, t.createdAt || new Date());
        }
        await MaintenanceTask.updateOne({ _id: t._id }, { $set: update });
      }
      console.log(`Updated ${taskChanges.length} work order(s).`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
