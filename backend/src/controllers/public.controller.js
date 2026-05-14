const Plant = require("../models/Plant");
const Device = require("../models/Device");
const WaterQualityState = require("../models/WaterQualityState");
const TelemetryReading = require("../models/TelemetryReading");
const PublicIssueReport = require("../models/PublicIssueReport");

function haversineKm(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function buildPlantStatus(plant) {
  const states = await WaterQualityState.find({ plantId: plant._id })
    .populate("deviceId", "deviceId availability status");
  const categories = states.map((s) => s.category);
  let overall = "NO_DATA";
  if (categories.includes("UNSAFE")) overall = "UNSAFE";
  else if (categories.includes("WARNING")) overall = "WARNING";
  else if (categories.includes("SAFE")) overall = "SAFE";
  const anyAvailable = states.some(
    (s) => s.deviceId && s.deviceId.availability === "AVAILABLE"
  );
  return { plant, overall, states, available: anyAvailable };
}

exports.listNearby = async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius || "50"); // km
    const all = await Plant.find();
    let withDist = all.map((p) => ({
      plant: p,
      distanceKm:
        Number.isFinite(lat) && Number.isFinite(lng)
          ? haversineKm({ lat, lng }, p.geo)
          : null
    }));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      withDist = withDist
        .filter((x) => x.distanceKm <= radius)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }
    const enriched = await Promise.all(
      withDist.map(async (x) => {
        const status = await buildPlantStatus(x.plant);
        return { ...status, distanceKm: x.distanceKm };
      })
    );
    res.json({ plants: enriched });
  } catch (err) {
    next(err);
  }
};

exports.plantStatus = async (req, res, next) => {
  try {
    const plant = await Plant.findById(req.params.id);
    if (!plant) return res.status(404).json({ error: "Plant not found" });
    const status = await buildPlantStatus(plant);

    // Latest readings per device in this plant
    const devices = await Device.find({ plantId: plant._id });
    const readings = {};
    for (const d of devices) {
      const r = await TelemetryReading.findOne({
        $or: [{ deviceRef: d._id }, { deviceId: d.deviceId }],
        readings: { $exists: true, $ne: null }
      })
        .sort({ timestamp: -1 })
        .lean();
      if (r) readings[d.deviceId] = r;
    }

    res.json({ ...status, devices, readings });
  } catch (err) {
    next(err);
  }
};

exports.createReport = async (req, res, next) => {
  try {
    const { plantId, locationText, category, description, contact } = req.body || {};
    if (!category || !description) {
      return res.status(400).json({ error: "category and description are required" });
    }
    const report = await PublicIssueReport.create({
      plantId: plantId || null,
      locationText: locationText || null,
      category,
      description,
      contact: contact || null,
      submittedByUserId: req.user ? req.user._id : null
    });
    res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
};

exports.myReports = async (req, res, next) => {
  try {
    const reports = await PublicIssueReport.find({ submittedByUserId: req.user._id })
      .populate("plantId", "name")
      .sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    next(err);
  }
};

exports.adminListReports = async (req, res, next) => {
  try {
    const { status, category } = req.query;
    const q = {};
    if (status) q.status = status;
    if (category) q.category = category;
    const reports = await PublicIssueReport.find(q)
      .populate("plantId", "name")
      .populate("submittedByUserId", "display_name email")
      .sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    next(err);
  }
};

exports.adminUpdateReport = async (req, res, next) => {
  try {
    const { status, resolutionNote } = req.body || {};
    const update = {};
    if (status) update.status = status;
    if (resolutionNote !== undefined) update.resolutionNote = resolutionNote;
    if (status && status !== "OPEN") {
      update.reviewedByUserId = req.user._id;
      update.reviewedAt = new Date();
    }
    const report = await PublicIssueReport.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    })
      .populate("plantId", "name")
      .populate("submittedByUserId", "display_name email");
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json({ report });
  } catch (err) {
    next(err);
  }
};
