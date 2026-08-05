/**
 * Renames the Plant.operationalStatus value OFFLINE -> CLOSED.
 *
 * "Offline" described a connectivity fault, which is a device concern; a plant
 * is a physical site that is open or closed. Without this migration, existing
 * rows keep the old value, fail the new enum on their next save, and render as
 * an unknown status in the UI.
 *
 * Only touches Plant.operationalStatus. Device availability, the DEVICE_OFFLINE
 * alert type and the MQTT LWT "offline" payload are deliberately left alone.
 *
 * Usage: node scripts/migrate-plant-status-closed.js [--dry-run] [--rollback]
 */
const mongoose = require("mongoose");
require("dotenv").config();

const Plant = require("../src/models/Plant");

const DRY_RUN = process.argv.includes("--dry-run");
const ROLLBACK = process.argv.includes("--rollback");

const FROM = ROLLBACK ? "CLOSED" : "OFFLINE";
const TO = ROLLBACK ? "OFFLINE" : "CLOSED";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);

  // Bypass the model layer: the enum no longer admits the old value, so a
  // strict find() would not match the very rows we need to fix.
  const collection = mongoose.connection.collection("plants");

  const affected = await collection
    .find({ operationalStatus: FROM }, { projection: { name: 1, operationalStatus: 1 } })
    .toArray();

  if (!affected.length) {
    console.log(`No plants with operationalStatus="${FROM}". Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  console.log(`${DRY_RUN ? "Would migrate" : "Migrating"} ${FROM} -> ${TO}:`);
  for (const p of affected) console.log(`  - ${p.name}`);

  if (!DRY_RUN) {
    const res = await collection.updateMany(
      { operationalStatus: FROM },
      { $set: { operationalStatus: TO } }
    );
    console.log(`Updated ${res.modifiedCount} plant(s).`);

    const leftover = await collection.countDocuments({ operationalStatus: FROM });
    if (leftover > 0) throw new Error(`${leftover} plant(s) still hold "${FROM}"`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
