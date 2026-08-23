/**
 * Assigns every plant a covering maintainer, grouped by geography.
 *
 * Islamabad's plants are spread across sectors, and a maintainer who has to
 * cross the city for every callout is a maintainer who arrives late. This walks
 * the plants in geographic order and hands each maintainer one or two
 * neighbours, so coverage is a short drive rather than an alphabetical accident.
 *
 * Idempotent: plants that already have coverage are left alone unless --reassign
 * is passed. Never removes coverage.
 *
 *   docker exec waternet-backend node scripts/assign-plant-coverage.js
 *   docker exec waternet-backend node scripts/assign-plant-coverage.js --reassign
 *   docker exec waternet-backend node scripts/assign-plant-coverage.js --per=2
 */
const mongoose = require("mongoose");
require("dotenv").config();

const Plant = require("../src/models/Plant");
const User = require("../src/models/User");

const REASSIGN = process.argv.includes("--reassign");
const perArg = process.argv.find((a) => a.startsWith("--per="));
const MAX_PER_MAINTAINER = perArg ? Math.max(1, parseInt(perArg.split("=")[1], 10) || 2) : 2;

// Rough great-circle distance in km. Precision beyond this does not matter:
// the question is "are these two plants near each other", not navigation.
function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Greedy nearest-neighbour chain: start at the most north-westerly plant and
 * repeatedly walk to the closest one not yet visited. Consecutive plants in
 * that order are neighbours, so slicing it into pairs gives each maintainer a
 * compact patch without needing a real clustering library.
 */
function orderByProximity(plants) {
  const remaining = [...plants];
  const ordered = [];

  let current = remaining.reduce((best, p) =>
    p.geo.lat + p.geo.lng > best.geo.lat + best.geo.lng ? p : best
  );
  remaining.splice(remaining.indexOf(current), 1);
  ordered.push(current);

  while (remaining.length) {
    let nearestIdx = 0;
    let nearest = Infinity;
    remaining.forEach((p, i) => {
      const d = distanceKm(current.geo, p.geo);
      if (d < nearest) {
        nearest = d;
        nearestIdx = i;
      }
    });
    current = remaining.splice(nearestIdx, 1)[0];
    ordered.push(current);
  }

  return ordered;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI);

  const maintainers = await User.find({ role: "MAINTAINER", active: true })
    .select("display_name email")
    .sort({ createdAt: 1 })
    .lean();

  if (!maintainers.length) throw new Error("no active maintainers to assign coverage to");

  const all = await Plant.find({ "geo.lat": { $ne: null } }).select("name geo coveringMaintainerId");
  const targets = REASSIGN ? all : all.filter((p) => !p.coveringMaintainerId);

  console.log(`${all.length} plants, ${maintainers.length} maintainers`);
  console.log(`${targets.length} to assign${REASSIGN ? " (reassigning all)" : ""}`);
  if (!targets.length) {
    console.log("Every plant already has coverage. Pass --reassign to redistribute.");
    await mongoose.disconnect();
    return;
  }

  const ordered = orderByProximity(targets);

  // Spread across everyone rather than loading the first few: with more
  // maintainers than plants need, each takes one before anybody takes two.
  const perMaintainer = Math.min(
    MAX_PER_MAINTAINER,
    Math.max(1, Math.ceil(ordered.length / maintainers.length))
  );

  const assignments = new Map();
  ordered.forEach((plant, i) => {
    const maintainer = maintainers[Math.floor(i / perMaintainer) % maintainers.length];
    assignments.set(String(plant._id), maintainer);
  });

  for (const plant of ordered) {
    const maintainer = assignments.get(String(plant._id));
    await Plant.updateOne({ _id: plant._id }, { coveringMaintainerId: maintainer._id });
  }

  // Report it back as patches, which is how a person checks the result.
  const byMaintainer = new Map();
  for (const plant of ordered) {
    const m = assignments.get(String(plant._id));
    const key = m.display_name || m.email;
    if (!byMaintainer.has(key)) byMaintainer.set(key, []);
    byMaintainer.get(key).push(plant);
  }

  console.log("\nCoverage:");
  for (const [name, plants] of byMaintainer) {
    const spread =
      plants.length > 1
        ? ` — ${distanceKm(plants[0].geo, plants[1].geo).toFixed(1)} km apart`
        : "";
    console.log(`  ${name}`);
    plants.forEach((p) => console.log(`    · ${p.name}`));
    if (spread) console.log(`   ${spread.trim()}`);
  }

  const uncovered = await Plant.countDocuments({ coveringMaintainerId: null });
  console.log(uncovered === 0 ? "\ndone — every plant is covered" : `\nWARNING: ${uncovered} uncovered`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
