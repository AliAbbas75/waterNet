/* eslint-disable no-console */
/**
 * Additive demo seed. Fills the system out so every screen has something real
 * on it — staff, work orders across their whole lifecycle, resolved alerts with
 * readable audit trails, citizen reports.
 *
 * ADDITIVE ONLY. This script never deletes, never truncates and never rewrites
 * an existing document's fields. It creates users that are missing, opens work
 * orders for live alerts that have none, and appends new records.
 *
 * Re-running is safe but not free: staff and the orphan-alert backfill are
 * idempotent, while the lifecycle work orders and closed incidents would be
 * added a second time. So a re-run stops unless --again is passed, rather than
 * quietly doubling the queue.
 *
 *   docker exec waternet-backend node scripts/seed-demo.js
 *   docker exec waternet-backend node scripts/seed-demo.js --volume=heavy
 *   docker exec waternet-backend node scripts/seed-demo.js --again
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { ethers } = require("ethers");

const { connectDb } = require("../src/config/db");
const User = require("../src/models/User");
const Plant = require("../src/models/Plant");
const Device = require("../src/models/Device");
const Alert = require("../src/models/Alert");
const AuditLog = require("../src/models/AuditLog");
const InventoryItem = require("../src/models/InventoryItem");
const MaintenanceTask = require("../src/models/MaintenanceTask");
const MaintenanceLog = require("../src/models/MaintenanceLog");
const PublicIssueReport = require("../src/models/PublicIssueReport");
const { createWalletForUser } = require("../src/services/wallet.service");
const { registerUserOnChain, isBlockchainEnabled } = require("../src/config/blockchain");
const { ownerRoleFor, severityFor, triageDueAt } = require("../src/services/alert.policy");

// Every document this script writes carries this, so a re-run can recognise its
// own output and so demo data can be told apart from data the system produced.
const MARK = "seed-demo";

const HEAVY = process.argv.includes("--volume=heavy");
const AGAIN = process.argv.includes("--again");

// ---------------------------------------------------------------- randomness
const rand = (min, max) => min + Math.random() * (max - min);
const int = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const hoursAgo = (h) => new Date(Date.now() - h * 3600000);
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

function sample(arr, n) {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

// ------------------------------------------------------------------ the cast
// A manager is the point of the new role: admin-side work now has somebody to
// be assigned TO, rather than an admin quietly assigning it to themselves.
const NEW_USERS = [
  { email: "manager@waternet.local", role: "MANAGER", display_name: "Zainab Qureshi" },
  { email: "manager2@waternet.local", role: "MANAGER", display_name: "Hamza Tariq" },
  { email: "tech4@waternet.local", role: "MAINTAINER", display_name: "Ayesha Siddiqui" },
  { email: "tech5@waternet.local", role: "MAINTAINER", display_name: "Kamran Javed" },
  { email: "citizen3@waternet.local", role: "PUBLIC", display_name: "Rabia Nawaz" },
  { email: "citizen4@waternet.local", role: "PUBLIC", display_name: "Faisal Mehmood" }
];

const FIELD_WORK = [
  ["Replace carbon filter cartridge", "Cartridge is past its rated throughput. Stock is on the shelf."],
  ["Recalibrate pH probe", "Readings drifting roughly 0.3 low against the 7.0 buffer."],
  ["Clean turbidity sensor housing", "Sediment build-up in the optical path is inflating NTU readings."],
  ["Replace RO membrane", "TDS rejection has fallen below spec over the last fortnight."],
  ["Check cabinet power supply", "Device is browning out; suspect the 12V adapter rather than the board."],
  ["Reseat sensor wiring loom", "Intermittent dropouts line up with vibration from the pump."],
  ["Flush intake line", "Flow rate down by a third with no change in demand."],
  ["Replace sediment pre-filter", "Differential pressure across the pre-filter is out of range."],
  ["Inspect pressure gauges", "Quarterly inspection — cross-check all four against the reference gauge."],
  ["Re-terminate antenna connector", "Signal strength dropped after last week's storm."],
  ["Swap out faulty TDS meter", "Meter reads a flat value regardless of the sample — sensor is dead."],
  ["Site survey for new device mount", "Current mount vibrates; find a rigid position on the wall."]
];

const OFFICE_WORK = [
  ["Raise purchase order for filter stock", "Carbon cartridges are below the reorder point across three plants."],
  ["Chase supplier on delayed membrane delivery", "RO membranes were due last Tuesday; confirm a new date."],
  ["Reconcile stock count against the ledger", "Physical count differs from the recorded quantity on two lines."],
  ["Source a second turbidity sensor supplier", "Single supplier lead time is four weeks and we have been caught twice."],
  ["Renew calibration solution subscription", "Buffer solutions expire next month across all sites."],
  ["Budget request for spare ESP32 units", "Spares are down to two; one more failure leaves a plant unmonitored."]
];

const RESOLUTIONS = [
  "Replaced the part and confirmed readings back inside range.",
  "Cleaned and recalibrated; verified against the reference sample before leaving site.",
  "Traced the fault to the power adapter. Swapped it, device stable for two hours.",
  "Refitted the loom with strain relief. No dropouts since.",
  "Stock delivered and counted in. Ledger now matches the shelf.",
  "Supplier confirmed dispatch; delivery logged against this order."
];

const PROGRESS_NOTES = [
  "On site. Isolated the unit and started the checks.",
  "First reading came back at 6.92 against the 7.0 buffer — adjusting offset.",
  "Part does not match the fitting. Ordering the correct size.",
  "Waiting on site access from the society office.",
  "Supplier says the shipment cleared customs this morning.",
  "Cross-checked against the neighbouring plant; the fault is local to this unit."
];

const BLOCKED_REASONS = [
  "Waiting on the replacement part to arrive.",
  "Society office has not granted access to the compound yet.",
  "Needs a second person for the lift — scheduled for Thursday.",
  "Supplier has not confirmed a delivery date."
];

const CITIZEN_REPORTS = [
  ["QUALITY", "Water has an odd metallic taste since yesterday evening."],
  ["QUALITY", "Cloudy water from the third tap on the left."],
  ["AVAILABILITY", "No flow at all this morning; queue of people waiting."],
  ["AVAILABILITY", "Plant closed during posted opening hours with no notice."],
  ["DEVICE", "The display panel is showing an error code and no readings."],
  ["DEVICE", "Card reader on the dispenser is not responding."],
  ["OTHER", "The approach path is flooded and hard to reach with containers."],
  ["QUALITY", "Slight chlorine smell stronger than usual this week."]
];

// ---------------------------------------------------------------------- users
async function seedUsers() {
  const blockchainEnabled = isBlockchainEnabled();
  const created = [];

  for (const spec of NEW_USERS) {
    const email = spec.email.toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`    ${email} already exists — left alone`);
      continue;
    }

    const wallet = ethers.Wallet.createRandom();
    const user = await User.create({
      ...spec,
      email,
      wallet_address: wallet.address,
      provider: "dev",
      provider_user_id: email,
      active: true,
      last_login_at: chance(0.7) ? hoursAgo(int(1, 72)) : null
    });

    if (blockchainEnabled) {
      await createWalletForUser(user._id, { wallet });
      // MANAGER maps down to the maintainer id on-chain: the registry only
      // knows four grades and mapping it up to ADMIN would hand it the
      // registry's own admin powers. See config/blockchain.js.
      await registerUserOnChain(wallet.address, user.role);
    }

    created.push(user);
    console.log(`    + ${user.display_name} (${user.role})`);
  }
  return created;
}

// --------------------------------------------------------------- work orders
/**
 * Gives every live alert that has no work order one, in TRIAGE.
 *
 * These are alerts acknowledged under the old flow, where acknowledging changed
 * a field and produced nothing. They are a state the system can no longer
 * reach, and leaving them makes the queue look broken. Additive: it opens
 * tickets, it does not touch the alerts beyond linking them.
 */
async function backfillOrphanAlerts(admin) {
  const live = await Alert.find({ status: { $in: ["OPEN", "ACK", "CLEARED_PENDING_REVIEW"] } });
  let opened = 0;

  for (const alert of live) {
    if (alert.ticketId) {
      const has = await MaintenanceTask.exists({
        _id: alert.ticketId,
        status: { $in: ["TRIAGE", "ASSIGNED", "IN_PROGRESS", "BLOCKED"] }
      });
      if (has) continue;
    }

    const plant = alert.plantId ? await Plant.findById(alert.plantId).select("name").lean() : null;
    const device = alert.deviceId ? await Device.findById(alert.deviceId).select("deviceId").lean() : null;
    const item = alert.inventoryItemId
      ? await InventoryItem.findById(alert.inventoryItemId).select("name").lean()
      : null;

    const severity = severityFor(alert.type);
    const subject = device?.deviceId || item?.name || plant?.name || "the network";

    const task = await MaintenanceTask.create({
      title: `${alert.type.replace(/_/g, " ").toLowerCase()} — ${subject}`,
      description: alert.message,
      status: "TRIAGE",
      origin: "SYSTEM",
      severity,
      ownerRole: ownerRoleFor(alert.type),
      triageDueAt: triageDueAt(severity, alert.createdAt || new Date()),
      plantId: alert.plantId || null,
      deviceId: alert.deviceId || null,
      externalRef: { type: "ALERT", id: alert._id, source: MARK }
    });

    await Alert.updateOne({ _id: alert._id }, { ticketId: task._id });
    await AuditLog.create({
      event: "ticket.opened",
      actorUserId: admin?._id || null,
      targetType: "TASK",
      targetId: task._id,
      meta: {
        raisedByAlert: String(alert._id),
        alertType: alert.type,
        severity,
        ownerRole: task.ownerRole,
        reason: "backfilled for an alert that had no work order",
        source: MARK
      },
      createdAt: alert.createdAt || new Date()
    });
    opened += 1;
  }
  return opened;
}

/** Builds one work order and everything that should exist alongside it. */
async function buildTicket({ status, admin, assignee, plant, device, spec, ownerRole, ageHours }) {
  const [title, description] = spec;
  const openedAt = hoursAgo(ageHours);
  const severity = pick(["MINOR", "MINOR", "MAJOR", "MAJOR", "CRITICAL"]);

  const task = await MaintenanceTask.create({
    title,
    description,
    status,
    origin: chance(0.55) ? "SYSTEM" : "MANUAL",
    severity,
    ownerRole,
    triageDueAt: triageDueAt(severity, openedAt),
    assignedToUserId: status === "TRIAGE" ? null : assignee._id,
    assignedByUserId: status === "TRIAGE" ? null : admin._id,
    assignedAt: status === "TRIAGE" ? openedAt : hoursAgo(ageHours - 0.5),
    triagedByUserId: status === "TRIAGE" ? null : admin._id,
    triagedAt: status === "TRIAGE" ? null : hoursAgo(ageHours - 0.5),
    plantId: plant?._id || null,
    deviceId: device?._id || null,
    externalRef: { type: "DEMO", source: MARK },
    resolvedAt: ["RESOLVED", "CANCELLED"].includes(status) ? hoursAgo(int(1, Math.max(2, ageHours - 2))) : null,
    resolvedByUserId: ["RESOLVED", "CANCELLED"].includes(status) ? assignee._id : null,
    resolutionSummary:
      status === "RESOLVED"
        ? pick(RESOLUTIONS)
        : status === "CANCELLED"
        ? "Stood down — the fault cleared before anyone was dispatched."
        : null,
    createdAt: openedAt
  });

  const logs = [];
  if (status !== "TRIAGE") {
    logs.push({
      taskId: task._id,
      authorUserId: admin._id,
      note: pick([
        "Assigned — please pick this up today.",
        "Routing this to you; the site key is with the guard.",
        "Take a spare with you, the last two failed the same way.",
        "Low priority, fit it around the scheduled visits."
      ]),
      structuredFields: { type: "DISPATCH", toUserId: assignee._id, source: MARK },
      createdAt: hoursAgo(ageHours - 0.5)
    });
  }
  if (["IN_PROGRESS", "BLOCKED", "RESOLVED"].includes(status)) {
    for (const note of sample(PROGRESS_NOTES, int(1, 3))) {
      logs.push({
        taskId: task._id,
        authorUserId: assignee._id,
        note,
        structuredFields: { source: MARK },
        createdAt: hoursAgo(int(1, Math.max(2, ageHours - 1)))
      });
    }
  }
  if (status === "BLOCKED") {
    logs.push({
      taskId: task._id,
      authorUserId: assignee._id,
      note: `Blocked: ${pick(BLOCKED_REASONS)}`,
      structuredFields: { type: "BLOCKED", source: MARK },
      createdAt: hoursAgo(int(1, Math.max(2, ageHours - 1)))
    });
  }
  if (status === "RESOLVED") {
    logs.push({
      taskId: task._id,
      authorUserId: assignee._id,
      note: task.resolutionSummary,
      structuredFields: { type: "RESOLUTION", source: MARK },
      createdAt: task.resolvedAt
    });
  }
  if (logs.length) await MaintenanceLog.insertMany(logs);

  // The audit trail behind the ticket, so its history reads as a story rather
  // than an empty modal.
  const audit = [
    {
      event: "ticket.opened",
      actorUserId: task.origin === "MANUAL" ? admin._id : null,
      targetType: "TASK",
      targetId: task._id,
      meta: { severity, ownerRole, source: MARK },
      createdAt: openedAt
    }
  ];
  if (status !== "TRIAGE") {
    audit.push({
      event: "ticket.triaged",
      actorUserId: admin._id,
      targetType: "TASK",
      targetId: task._id,
      meta: {
        assignedTo: assignee.display_name,
        assignedToUserId: String(assignee._id),
        role: assignee.role,
        severity,
        source: MARK
      },
      createdAt: hoursAgo(ageHours - 0.5)
    });
  }
  if (status === "CANCELLED") {
    audit.push({
      event: "ticket.cancelled",
      actorUserId: admin._id,
      targetType: "TASK",
      targetId: task._id,
      meta: { reason: task.resolutionSummary, severity, source: MARK },
      createdAt: task.resolvedAt
    });
  }
  await AuditLog.insertMany(audit);

  return task;
}

/**
 * A finished incident: an alert, the work order that answered it, and the audit
 * trail joining the two. This is what the History button is for.
 */
async function buildClosedIncident({ admin, assignee, plant, device, ageHours }) {
  const type = pick(["DEVICE_OFFLINE", "DEVICE_FLAPPING", "QUALITY_UNSAFE"]);
  const severity = severityFor(type);
  const raisedAt = hoursAgo(ageHours);
  const dispatchedAt = hoursAgo(ageHours - rand(0.3, 2));
  const resolvedAt = hoursAgo(Math.max(0.5, ageHours - rand(3, 20)));

  const message =
    type === "DEVICE_OFFLINE"
      ? `Device ${device.deviceId} stopped reporting`
      : type === "DEVICE_FLAPPING"
      ? `Device ${device.deviceId} cycling between online and offline`
      : `Readings breached safe limits at ${plant.name}`;

  const alert = await Alert.create({
    type,
    severity,
    plantId: plant._id,
    deviceId: device._id,
    message,
    status: "RESOLVED",
    ackAt: dispatchedAt,
    ackByUserId: admin._id,
    resolvedAt,
    resolvedByUserId: assignee._id,
    createdAt: raisedAt
  });

  const summary = pick(RESOLUTIONS);
  const task = await MaintenanceTask.create({
    title: `${type.replace(/_/g, " ").toLowerCase()} — ${device.deviceId}`,
    description: message,
    status: "RESOLVED",
    origin: "SYSTEM",
    severity,
    ownerRole: ownerRoleFor(type),
    triageDueAt: triageDueAt(severity, raisedAt),
    assignedToUserId: assignee._id,
    assignedByUserId: admin._id,
    assignedAt: dispatchedAt,
    triagedByUserId: admin._id,
    triagedAt: dispatchedAt,
    plantId: plant._id,
    deviceId: device._id,
    externalRef: { type: "ALERT", id: alert._id, source: MARK },
    resolvedAt,
    resolvedByUserId: assignee._id,
    resolutionSummary: summary,
    checklist:
      type === "QUALITY_UNSAFE"
        ? [
            { label: "Plant physically closed to the public", effect: "CLOSE_PLANT", done: true, completedByUserId: assignee._id, completedAt: resolvedAt },
            { label: "Public advisory issued", done: true, completedByUserId: assignee._id, completedAt: resolvedAt },
            { label: "Sample taken for laboratory confirmation", done: true, completedByUserId: assignee._id, completedAt: resolvedAt },
            { label: "Source of contamination identified", done: true, completedByUserId: assignee._id, completedAt: resolvedAt }
          ]
        : [],
    createdAt: raisedAt
  });

  await Alert.updateOne({ _id: alert._id }, { ticketId: task._id });

  await MaintenanceLog.insertMany([
    {
      taskId: task._id,
      authorUserId: admin._id,
      note: "Assigned from the alert queue.",
      structuredFields: { type: "DISPATCH", toUserId: assignee._id, source: MARK },
      createdAt: dispatchedAt
    },
    {
      taskId: task._id,
      authorUserId: assignee._id,
      note: summary,
      structuredFields: { type: "RESOLUTION", source: MARK },
      createdAt: resolvedAt
    }
  ]);

  await AuditLog.insertMany([
    {
      event: "alert.raised",
      targetType: "ALERT",
      targetId: alert._id,
      meta: { type, severity, message, source: MARK },
      createdAt: raisedAt
    },
    {
      event: "ticket.opened",
      targetType: "TASK",
      targetId: task._id,
      meta: { raisedByAlert: String(alert._id), alertType: type, severity, source: MARK },
      createdAt: raisedAt
    },
    {
      event: "alert.dispatched",
      actorUserId: admin._id,
      targetType: "ALERT",
      targetId: alert._id,
      meta: {
        type,
        severity,
        ticketId: String(task._id),
        assignedTo: assignee.display_name,
        role: assignee.role,
        note: "Assigned from the alert queue.",
        source: MARK
      },
      createdAt: dispatchedAt
    },
    {
      event: "ticket.triaged",
      actorUserId: admin._id,
      targetType: "TASK",
      targetId: task._id,
      meta: { assignedTo: assignee.display_name, role: assignee.role, severity, source: MARK },
      createdAt: dispatchedAt
    },
    {
      event: "alert.resolved_by_ticket",
      actorUserId: assignee._id,
      targetType: "ALERT",
      targetId: alert._id,
      meta: { type, severity, ticketId: String(task._id), note: summary, source: MARK },
      createdAt: resolvedAt
    }
  ]);

  return { alert, task };
}

async function seedReports(citizens, plants) {
  const docs = [];
  for (const [category, description] of sample(CITIZEN_REPORTS, HEAVY ? 8 : 5)) {
    const status = pick(["OPEN", "OPEN", "IN_REVIEW", "CLOSED"]);
    docs.push({
      plantId: pick(plants)._id,
      category,
      description,
      status,
      submittedByUserId: citizens.length ? pick(citizens)._id : null,
      contact: chance(0.5) ? `+92-3${int(10, 49)}-${int(1000000, 9999999)}` : null,
      resolutionNote: status === "CLOSED" ? "Checked on site; readings normal and flow restored." : null,
      createdAt: hoursAgo(int(2, 400))
    });
  }
  await PublicIssueReport.insertMany(docs);
  return docs.length;
}

// ------------------------------------------------------------------- runner
(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("MONGODB_URI not set.");
      process.exit(1);
    }
    await connectDb();
    console.log(`Additive demo seed${HEAVY ? " (heavy)" : ""} — nothing is deleted or overwritten.\n`);

    console.log("- staff");
    await seedUsers();

    const admins = await User.find({ role: { $in: ["ADMIN", "SUPER_ADMIN"] }, active: true });
    const maintainers = await User.find({ role: "MAINTAINER", active: true });
    const managers = await User.find({ role: "MANAGER", active: true });
    const citizens = await User.find({ role: "PUBLIC" });
    const plants = await Plant.find();
    const devices = await Device.find({ plantId: { $ne: null } });

    if (!admins.length || !maintainers.length || !plants.length) {
      throw new Error("no admins, maintainers or plants to build against — run scripts/seed.js first");
    }

    console.log("- work orders for alerts that had none");
    const backfilled = await backfillOrphanAlerts(admins[0]);
    console.log(`    ${backfilled} opened in TRIAGE`);

    // Everything above this line is idempotent. Everything below it appends,
    // so a second run without --again would silently double the queue.
    const alreadySeeded = await MaintenanceTask.countDocuments({ "externalRef.source": MARK });
    if (alreadySeeded && !AGAIN) {
      console.log(`
${alreadySeeded} demo work orders are already here.`);
      console.log("Staff and the alert backfill are up to date; stopping before adding more.");
      console.log("Pass --again to append another round.");
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log("- work orders across the lifecycle");
    const plan = HEAVY
      ? { TRIAGE: 4, ASSIGNED: 8, IN_PROGRESS: 6, BLOCKED: 3, RESOLVED: 14, CANCELLED: 3 }
      : { TRIAGE: 2, ASSIGNED: 5, IN_PROGRESS: 4, BLOCKED: 2, RESOLVED: 8, CANCELLED: 2 };

    let made = 0;
    for (const [status, count] of Object.entries(plan)) {
      for (let i = 0; i < count; i++) {
        // Roughly a third of the queue is manager-side work, which is what the
        // role exists for: somewhere for procurement to be assigned.
        const office = managers.length && chance(0.34);
        const assignee = office ? pick(managers) : pick(maintainers);
        const plant = pick(plants);
        const device = office
          ? null
          : devices.find((d) => String(d.plantId) === String(plant._id)) || null;

        await buildTicket({
          status,
          admin: pick(admins),
          assignee,
          plant: office ? null : plant,
          device,
          spec: office ? pick(OFFICE_WORK) : pick(FIELD_WORK),
          ownerRole: office ? "MANAGER" : "MAINTAINER",
          ageHours: int(2, HEAVY ? 900 : 400)
        });
        made += 1;
      }
    }
    console.log(`    ${made} work orders`);

    console.log("- closed incidents with full audit trails");
    const withDevices = devices.filter((d) => d.plantId);
    let incidents = 0;
    for (let i = 0; i < (HEAVY ? 12 : 7) && withDevices.length; i++) {
      const device = pick(withDevices);
      const plant = plants.find((p) => String(p._id) === String(device.plantId));
      if (!plant) continue;
      await buildClosedIncident({
        admin: pick(admins),
        assignee: pick(maintainers),
        plant,
        device,
        ageHours: int(6, HEAVY ? 900 : 400)
      });
      incidents += 1;
    }
    console.log(`    ${incidents} incidents (alert + work order + trail)`);

    console.log("- citizen reports");
    console.log(`    ${await seedReports(citizens, plants)} reports`);

    // ------------------------------------------------------------ what it made
    const [users, tasks, alerts, audit] = await Promise.all([
      User.countDocuments(),
      MaintenanceTask.countDocuments(),
      Alert.countDocuments(),
      AuditLog.countDocuments()
    ]);
    console.log("\nTotals now in the database:");
    console.log(`  users ${users} · work orders ${tasks} · alerts ${alerts} · audit entries ${audit}`);
    console.log("\nNew sign-ins: manager@waternet.local, manager2@waternet.local (MANAGER)");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Demo seed failed:", err);
    process.exit(1);
  }
})();
