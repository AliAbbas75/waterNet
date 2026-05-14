/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");

const { connectDb } = require("../src/config/db");
const User = require("../src/models/User");
const Plant = require("../src/models/Plant");
const Device = require("../src/models/Device");
const TelemetryReading = require("../src/models/TelemetryReading");
const ThresholdConfig = require("../src/models/ThresholdConfig");
const WaterQualityState = require("../src/models/WaterQualityState");
const Alert = require("../src/models/Alert");
const InventoryItem = require("../src/models/InventoryItem");
const MaintenanceTask = require("../src/models/MaintenanceTask");
const MaintenanceLog = require("../src/models/MaintenanceLog");
const PublicIssueReport = require("../src/models/PublicIssueReport");

function rand(min, max) {
  return min + Math.random() * (max - min);
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function fakeWallet(seed) {
  // Deterministic fake 0x-style address (lowercased).
  const hex = require("crypto")
    .createHash("sha256")
    .update(String(seed))
    .digest("hex")
    .slice(0, 40);
  return "0x" + hex;
}

const USERS = [
  { email: "super@waternet.local", role: "SUPER_ADMIN", display_name: "Sara Khan" },
  { email: "admin@waternet.local", role: "ADMIN", display_name: "Asad Iqbal" },
  { email: "admin2@waternet.local", role: "ADMIN", display_name: "Hira Malik" },
  { email: "tech1@waternet.local", role: "MAINTAINER", display_name: "Bilal Ahmed" },
  { email: "tech2@waternet.local", role: "MAINTAINER", display_name: "Noor Fatima" },
  { email: "tech3@waternet.local", role: "MAINTAINER", display_name: "Usman Raza" },
  { email: "citizen1@waternet.local", role: "PUBLIC", display_name: "Ali Hassan" },
  { email: "citizen2@waternet.local", role: "PUBLIC", display_name: "Mariam Sheikh" }
];

const PLANTS = [
  { name: "E-11 Markaz Filter Plant", address: "E-11/2, Islamabad", lat: 33.7016, lng: 72.9764, status: "OPERATIONAL", hours: "06:00-22:00" },
  { name: "F-7 Municipal Plant", address: "F-7 Markaz, Islamabad", lat: 33.7203, lng: 73.0539, status: "OPERATIONAL", hours: "24/7" },
  { name: "F-10 Community Filter", address: "F-10/3, Islamabad", lat: 33.6911, lng: 73.0103, status: "OPERATIONAL", hours: "06:00-22:00" },
  { name: "G-9 Karachi Company Plant", address: "G-9 Markaz, Islamabad", lat: 33.6948, lng: 73.0312, status: "MAINTENANCE", hours: "06:00-22:00" },
  { name: "G-13 Society Plant", address: "G-13/3, Islamabad", lat: 33.6529, lng: 72.9659, status: "OPERATIONAL", hours: "06:00-22:00" },
  { name: "H-8 Sector Plant", address: "H-8/1, Islamabad", lat: 33.6796, lng: 73.0698, status: "OPERATIONAL", hours: "24/7" },
  { name: "I-8 Industrial Filter", address: "I-8/4, Islamabad", lat: 33.6705, lng: 73.0789, status: "OFFLINE", hours: "06:00-22:00" },
  { name: "Bahria Town Phase 4 Plant", address: "Bahria Town, Rawalpindi", lat: 33.5346, lng: 73.0974, status: "OPERATIONAL", hours: "24/7" }
];

const INVENTORY = [
  { category: "sensor", name: "pH Probe (Gravity)", quantity: 14, reorderThreshold: 5, unit: "units" },
  { category: "sensor", name: "Turbidity Sensor Module", quantity: 9, reorderThreshold: 5, unit: "units" },
  { category: "sensor", name: "TDS Meter V1.0", quantity: 3, reorderThreshold: 5, unit: "units" }, // low
  { category: "sensor", name: "DS18B20 Temperature Probe", quantity: 22, reorderThreshold: 5, unit: "units" },
  { category: "device", name: "ESP32 DevKit V1", quantity: 7, reorderThreshold: 4, unit: "units" },
  { category: "device", name: "ESP32 WROOM-32", quantity: 2, reorderThreshold: 4, unit: "units" }, // low
  { category: "filter", name: "Carbon Filter Cartridge 10\"", quantity: 18, reorderThreshold: 6, unit: "units" },
  { category: "filter", name: "Sediment Filter 5 micron", quantity: 12, reorderThreshold: 6, unit: "units" },
  { category: "filter", name: "RO Membrane 100 GPD", quantity: 4, reorderThreshold: 3, unit: "units" },
  { category: "consumable", name: "pH Buffer Solution 7.0", quantity: 24, reorderThreshold: 10, unit: "bottles" },
  { category: "consumable", name: "Calibration Solution TDS 342ppm", quantity: 11, reorderThreshold: 8, unit: "bottles" },
  { category: "tool", name: "Pipe Wrench 14\"", quantity: 5, reorderThreshold: 2, unit: "units" },
  { category: "tool", name: "Multimeter (Digital)", quantity: 3, reorderThreshold: 2, unit: "units" }
];

const THRESHOLDS_GLOBAL = [
  { parameter: "pH", safeMin: 6.5, safeMax: 8.5, warnMin: 6.0, warnMax: 9.0, unsafeMin: 0, unsafeMax: 14 },
  { parameter: "turbidity", safeMin: 0, safeMax: 1.0, warnMin: 0, warnMax: 4.0, unsafeMin: 0, unsafeMax: 1000 },
  { parameter: "temperature", safeMin: 5, safeMax: 35, warnMin: 2, warnMax: 40, unsafeMin: -5, unsafeMax: 60 },
  { parameter: "TDS", safeMin: 0, safeMax: 500, warnMin: 0, warnMax: 900, unsafeMin: 0, unsafeMax: 5000 }
];

async function clear() {
  await Promise.all([
    User.deleteMany({}),
    Plant.deleteMany({}),
    Device.deleteMany({}),
    TelemetryReading.deleteMany({}),
    ThresholdConfig.deleteMany({}),
    WaterQualityState.deleteMany({}),
    Alert.deleteMany({}),
    InventoryItem.deleteMany({}),
    MaintenanceTask.deleteMany({}),
    MaintenanceLog.deleteMany({}),
    PublicIssueReport.deleteMany({})
  ]);
}

async function seedUsers() {
  const docs = USERS.map((u) => ({
    ...u,
    email: u.email.toLowerCase(),
    wallet_address: fakeWallet(u.email),
    provider: "dev",
    provider_user_id: u.email,
    active: true,
    last_login_at: null
  }));
  const created = await User.insertMany(docs);
  console.log(`  ${created.length} users`);
  return created;
}

async function seedPlants() {
  const docs = PLANTS.map((p) => ({
    name: p.name,
    address: p.address,
    geo: { lat: p.lat, lng: p.lng },
    operationalStatus: p.status,
    operatingHours: p.hours
  }));
  const created = await Plant.insertMany(docs);
  console.log(`  ${created.length} plants`);
  return created;
}

async function seedThresholds(plants) {
  const docs = THRESHOLDS_GLOBAL.map((t) => ({ ...t, plantId: null }));
  // Per-plant override for F-7 with tighter pH band.
  const fseven = plants.find((p) => p.name.includes("F-7"));
  if (fseven) {
    docs.push({ plantId: fseven._id, parameter: "pH", safeMin: 6.8, safeMax: 8.2, warnMin: 6.3, warnMax: 8.7, unsafeMin: 0, unsafeMax: 14 });
  }
  const created = await ThresholdConfig.insertMany(docs);
  console.log(`  ${created.length} thresholds`);
}

async function seedDevices(plants) {
  const devices = [];
  let counter = 1;
  for (const p of plants) {
    const count = p.operationalStatus === "OFFLINE" ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const deviceId = `WN-${String(counter).padStart(4, "0")}`;
      const offline = p.operationalStatus === "OFFLINE";
      const maintenance = p.operationalStatus === "MAINTENANCE" && i === 1;
      devices.push({
        deviceId,
        plantId: p._id,
        installDate: new Date(Date.now() - rand(30, 365) * 86400000),
        status: maintenance ? "MAINTENANCE" : "INSTALLED",
        firmwareVersion: pick(["1.0.3", "1.1.0", "1.2.1"]),
        lastSeenAt: offline ? new Date(Date.now() - 3600000) : new Date(),
        availability: offline ? "UNAVAILABLE" : "AVAILABLE",
        disabled: false
      });
      counter++;
    }
  }
  // One spare available device + one disabled device.
  devices.push({
    deviceId: `WN-${String(counter).padStart(4, "0")}`,
    plantId: null,
    installDate: null,
    status: "AVAILABLE",
    firmwareVersion: "1.2.1",
    lastSeenAt: null,
    availability: "UNAVAILABLE",
    disabled: false
  });
  counter++;
  devices.push({
    deviceId: `WN-${String(counter).padStart(4, "0")}`,
    plantId: null,
    installDate: new Date(Date.now() - 200 * 86400000),
    status: "FAULTY",
    firmwareVersion: "1.0.3",
    lastSeenAt: new Date(Date.now() - 30 * 86400000),
    availability: "UNAVAILABLE",
    disabled: true
  });
  const created = await Device.insertMany(devices);
  console.log(`  ${created.length} devices`);
  return created;
}

async function seedTelemetry(devices) {
  const docs = [];
  const now = Date.now();
  // Last 7 days, every 30 minutes, per active device.
  const stepMs = 30 * 60 * 1000;
  const horizon = 7 * 24 * 60 * 60 * 1000;
  const points = Math.floor(horizon / stepMs);

  // Tag a couple of plants to push UNSAFE recently for demo.
  const unsafeDeviceIds = new Set(
    devices
      .filter((d) => d.status === "INSTALLED" && d.availability === "AVAILABLE")
      .slice(0, 2)
      .map((d) => d.deviceId)
  );

  for (const d of devices) {
    if (d.disabled) continue;
    if (d.status === "AVAILABLE") continue; // unassigned spare — no telemetry
    if (d.availability === "UNAVAILABLE" && d.status !== "MAINTENANCE") {
      // Offline-plant device — only old readings.
      for (let i = points; i > Math.floor(points * 0.7); i--) {
        const ts = new Date(now - i * stepMs);
        docs.push({
          deviceRef: d._id,
          deviceId: d.deviceId,
          plantId: d.plantId,
          timestamp: ts,
          readings: {
            pH: rand(7.0, 7.6),
            turbidity: rand(0.3, 0.9),
            temperature: rand(18, 26),
            TDS: rand(150, 280)
          },
          ingestMeta: { schemaVersion: "v1", protocol: "MQTT" }
        });
      }
      continue;
    }
    for (let i = points; i >= 0; i--) {
      const ts = new Date(now - i * stepMs);
      const baseline = {
        pH: rand(6.8, 7.8),
        turbidity: rand(0.2, 0.9),
        temperature: rand(18, 28),
        TDS: rand(180, 340)
      };
      // Force unsafe readings within the last 4 hours for tagged devices.
      if (unsafeDeviceIds.has(d.deviceId) && i < 8) {
        baseline.turbidity = rand(2.0, 5.5); // out of safe range
        baseline.TDS = rand(700, 1100);
      }
      docs.push({
        deviceRef: d._id,
        deviceId: d.deviceId,
        plantId: d.plantId,
        timestamp: ts,
        readings: baseline,
        ingestMeta: { schemaVersion: "v1", protocol: "MQTT" }
      });
    }
  }
  // Insert in chunks to avoid hitting BSON size limits.
  for (let i = 0; i < docs.length; i += 5000) {
    await TelemetryReading.insertMany(docs.slice(i, i + 5000), { ordered: false });
  }
  console.log(`  ${docs.length} telemetry readings`);
}

async function evaluateAll(devices) {
  // Run analysis for each plant/device with telemetry so WaterQualityState is filled in.
  const { evaluateQuality } = require("../src/controllers/analysis.controller");
  let states = 0;
  for (const d of devices) {
    if (!d.plantId || d.disabled) continue;
    try {
      await evaluateQuality(d.plantId, d._id, d.deviceId);
      states++;
    } catch (err) {
      console.warn("    evaluate failed for", d.deviceId, err.message);
    }
  }
  console.log(`  evaluated ${states} water quality states`);
}

async function seedAlerts(devices, plants) {
  // Most alerts already exist via inventory/evaluate. Add a few historical resolved ones.
  const d = devices.find((x) => x.status === "INSTALLED" && x.plantId);
  const p = plants[0];
  const docs = [
    {
      type: "DEVICE_OFFLINE",
      severity: "WARN",
      plantId: p._id,
      deviceId: d?._id || null,
      message: `Device ${d?.deviceId || "WN-0001"} was offline for 12 minutes`,
      status: "RESOLVED",
      ackAt: new Date(Date.now() - 4 * 3600000),
      resolvedAt: new Date(Date.now() - 2 * 3600000)
    },
    {
      type: "QUALITY_UNSAFE",
      severity: "CRITICAL",
      plantId: p._id,
      deviceId: d?._id || null,
      message: "Turbidity spiked above 4 NTU",
      status: "ACK",
      ackAt: new Date(Date.now() - 30 * 60000)
    }
  ];
  await Alert.insertMany(docs);
  console.log(`  ${docs.length} historical alerts`);
}

async function seedInventory() {
  const created = await InventoryItem.insertMany(INVENTORY);
  // Generate LOW_INVENTORY alerts for items below threshold.
  const low = created.filter((i) => i.quantity < i.reorderThreshold);
  await Alert.insertMany(
    low.map((i) => ({
      type: "LOW_INVENTORY",
      severity: "WARN",
      inventoryItemId: i._id,
      message: `${i.name} below reorder threshold (${i.quantity}/${i.reorderThreshold})`,
      status: "OPEN"
    }))
  );
  console.log(`  ${created.length} inventory items (${low.length} low-stock alerts)`);
}

async function seedTasks(users, plants, devices) {
  const admin = users.find((u) => u.role === "ADMIN");
  const tech1 = users.find((u) => u.email === "tech1@waternet.local");
  const tech2 = users.find((u) => u.email === "tech2@waternet.local");
  const tech3 = users.find((u) => u.email === "tech3@waternet.local");

  const pAlpha = plants[0];
  const pBeta = plants[1];
  const pGamma = plants[3];
  const dAlpha = devices.find((d) => String(d.plantId) === String(pAlpha._id));
  const dBeta = devices.find((d) => String(d.plantId) === String(pBeta._id));
  const dGamma = devices.find((d) => String(d.plantId) === String(pGamma._id));

  const tasks = [
    {
      title: "Replace water filter cartridge",
      description: "Carbon filter at filter plant Alpha is overdue for replacement. Stock available.",
      status: "ASSIGNED",
      assignedToUserId: tech1._id,
      assignedByUserId: admin._id,
      assignedAt: new Date(Date.now() - 6 * 3600000),
      plantId: pAlpha._id,
      deviceId: dAlpha?._id || null
    },
    {
      title: "Calibrate pH sensor",
      description: "pH readings drifting; recalibrate against 7.0 buffer.",
      status: "IN_PROGRESS",
      assignedToUserId: tech1._id,
      assignedByUserId: admin._id,
      assignedAt: new Date(Date.now() - 2 * 3600000),
      plantId: pBeta._id,
      deviceId: dBeta?._id || null
    },
    {
      title: "Investigate high TDS reading",
      description: "TDS spiked above 700 ppm yesterday; verify membrane health and sensor calibration.",
      status: "ASSIGNED",
      assignedToUserId: tech2._id,
      assignedByUserId: admin._id,
      assignedAt: new Date(Date.now() - 30 * 60000),
      plantId: pGamma._id,
      deviceId: dGamma?._id || null
    },
    {
      title: "Check turbidity meter readings",
      description: "Routine inspection — visual + sensor cross-check.",
      status: "ASSIGNED",
      assignedToUserId: tech3._id,
      assignedByUserId: admin._id,
      assignedAt: new Date(Date.now() - 12 * 3600000),
      plantId: pAlpha._id
    },
    {
      title: "Inspect pressure gauges",
      description: "Quarterly inspection at plant Delta.",
      status: "RESOLVED",
      assignedToUserId: tech2._id,
      assignedByUserId: admin._id,
      assignedAt: new Date(Date.now() - 48 * 3600000),
      resolvedAt: new Date(Date.now() - 30 * 3600000),
      resolvedByUserId: tech2._id,
      resolutionSummary: "All gauges within tolerance.",
      plantId: plants[4]._id
    },
    {
      title: "Clean water tank",
      description: "Scheduled cleaning of intake tank.",
      status: "RESOLVED",
      assignedToUserId: tech1._id,
      assignedByUserId: admin._id,
      assignedAt: new Date(Date.now() - 72 * 3600000),
      resolvedAt: new Date(Date.now() - 60 * 3600000),
      resolvedByUserId: tech1._id,
      resolutionSummary: "Cleaned and refilled. New filter cartridge installed.",
      plantId: plants[2]._id
    }
  ];

  const created = await MaintenanceTask.insertMany(tasks);

  // A couple of logs.
  await MaintenanceLog.insertMany([
    {
      taskId: created[1]._id, // IN_PROGRESS task
      authorUserId: tech1._id,
      note: "Connected calibration kit; first buffer reading came back at 6.92."
    },
    {
      taskId: created[1]._id,
      authorUserId: tech1._id,
      note: "After offset adjustment, reads 7.01 against 7.0 buffer. Will continue with 4.0 buffer."
    },
    {
      taskId: created[4]._id, // RESOLVED
      authorUserId: tech2._id,
      note: "Inspected all 4 gauges. Reads: 28, 31, 27, 30 psi. Within tolerance."
    }
  ]);

  console.log(`  ${created.length} maintenance tasks, 3 logs`);
}

async function seedReports(users, plants) {
  const citizen1 = users.find((u) => u.email === "citizen1@waternet.local");
  const citizen2 = users.find((u) => u.email === "citizen2@waternet.local");
  await PublicIssueReport.insertMany([
    {
      plantId: plants[0]._id,
      category: "QUALITY",
      description: "Water has a strange taste this morning at E-11.",
      status: "OPEN",
      submittedByUserId: citizen1._id,
      contact: "citizen1@waternet.local"
    },
    {
      plantId: plants[3]._id,
      category: "AVAILABILITY",
      description: "G-9 plant has had no water flow since yesterday evening.",
      status: "IN_REVIEW",
      submittedByUserId: citizen2._id,
      contact: "+92-300-1234567"
    },
    {
      plantId: plants[2]._id,
      category: "DEVICE",
      description: "Display panel at F-10 is showing an error code.",
      status: "CLOSED",
      submittedByUserId: citizen1._id,
      resolutionNote: "Display panel reset by tech1; back online."
    }
  ]);
  console.log("  3 public reports");
}

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("MONGODB_URI not set; copy backend/.env.example to backend/.env first.");
      process.exit(1);
    }
    await connectDb();

    // Idempotent by default: if data exists, skip. Force a fresh reseed with SEED_FORCE=true.
    const force = String(process.env.SEED_FORCE || "").toLowerCase() === "true";
    const existing = await User.countDocuments();
    if (existing > 0 && !force) {
      console.log(`Seed skipped — found ${existing} existing users. Set SEED_FORCE=true to reseed.`);
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log("Seeding WaterNet database…");
    console.log("- clearing collections");
    await clear();
    console.log("- users");
    const users = await seedUsers();
    console.log("- plants");
    const plants = await seedPlants();
    console.log("- thresholds");
    await seedThresholds(plants);
    console.log("- devices");
    const devices = await seedDevices(plants);
    console.log("- telemetry");
    await seedTelemetry(devices);
    console.log("- water quality states");
    await evaluateAll(devices);
    console.log("- alerts");
    await seedAlerts(devices, plants);
    console.log("- inventory");
    await seedInventory();
    console.log("- maintenance tasks");
    await seedTasks(users, plants, devices);
    console.log("- public reports");
    await seedReports(users, plants);
    console.log("Done.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
})();
