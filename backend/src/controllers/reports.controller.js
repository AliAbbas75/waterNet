const TelemetryReading = require("../models/TelemetryReading");
const MaintenanceTask = require("../models/MaintenanceTask");
const Device = require("../models/Device");
const Plant = require("../models/Plant");
const WaterQualityState = require("../models/WaterQualityState");
const Alert = require("../models/Alert");

const PARAM_KEYS = ["pH", "turbidity", "temperature", "TDS"];

function parseRange(req) {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from
    ? new Date(req.query.from)
    : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from, to };
}

// GET /api/reports/quality/trends?plantId=&from=&to=&bucket=hour|day
exports.qualityTrends = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const bucket = req.query.bucket === "hour" ? "hour" : "day";
    const match = { timestamp: { $gte: from, $lte: to }, readings: { $exists: true, $ne: null } };
    if (req.query.plantId) {
      const mongoose = require("mongoose");
      match.plantId = new mongoose.Types.ObjectId(req.query.plantId);
    }
    const groupKey =
      bucket === "hour"
        ? {
            y: { $year: "$timestamp" },
            m: { $month: "$timestamp" },
            d: { $dayOfMonth: "$timestamp" },
            h: { $hour: "$timestamp" }
          }
        : {
            y: { $year: "$timestamp" },
            m: { $month: "$timestamp" },
            d: { $dayOfMonth: "$timestamp" }
          };
    const agg = await TelemetryReading.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupKey,
          ts: { $min: "$timestamp" },
          pH: { $avg: "$readings.pH" },
          turbidity: { $avg: "$readings.turbidity" },
          temperature: { $avg: "$readings.temperature" },
          TDS: { $avg: "$readings.TDS" },
          count: { $sum: 1 }
        }
      },
      { $sort: { ts: 1 } }
    ]);
    res.json({ from, to, bucket, points: agg });
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/maintenance/performance?from=&to=
exports.maintenancePerformance = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const tasks = await MaintenanceTask.find({
      createdAt: { $gte: from, $lte: to }
    }).populate("assignedToUserId", "display_name email");

    const byStatus = { ASSIGNED: 0, IN_PROGRESS: 0, RESOLVED: 0, CANCELLED: 0 };
    let totalResolveMinutes = 0;
    let resolvedCount = 0;
    const byUser = {};
    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      if (t.status === "RESOLVED" && t.resolvedAt) {
        const mins = (new Date(t.resolvedAt).getTime() - new Date(t.assignedAt).getTime()) / 60000;
        totalResolveMinutes += Math.max(0, mins);
        resolvedCount++;
        const key = t.assignedToUserId ? String(t.assignedToUserId._id) : "unassigned";
        if (!byUser[key]) {
          byUser[key] = {
            user: t.assignedToUserId
              ? { id: t.assignedToUserId._id, name: t.assignedToUserId.display_name || t.assignedToUserId.email }
              : { id: null, name: "Unassigned" },
            resolved: 0,
            totalMinutes: 0
          };
        }
        byUser[key].resolved++;
        byUser[key].totalMinutes += Math.max(0, mins);
      }
    }
    const mttrMinutes = resolvedCount ? totalResolveMinutes / resolvedCount : 0;

    const leaderboard = Object.values(byUser).map((u) => ({
      ...u,
      avgMinutes: u.resolved ? u.totalMinutes / u.resolved : 0
    }));
    leaderboard.sort((a, b) => b.resolved - a.resolved);

    res.json({
      from,
      to,
      totalTasks: tasks.length,
      byStatus,
      mttrMinutes,
      leaderboard
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/uptime?from=&to=
// Approximates uptime per device: ratio of readings observed vs expected (every 15 min for telemetry).
exports.uptime = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req);
    const devices = await Device.find({ disabled: false }).populate("plantId", "name");
    const expected = Math.max(1, Math.floor((to.getTime() - from.getTime()) / (15 * 60 * 1000)));
    const out = [];
    for (const d of devices) {
      const count = await TelemetryReading.countDocuments({
        $or: [{ deviceRef: d._id }, { deviceId: d.deviceId }],
        timestamp: { $gte: from, $lte: to },
        readings: { $exists: true, $ne: null }
      });
      out.push({
        deviceId: d.deviceId,
        device_oid: d._id,
        plant: d.plantId ? { id: d.plantId._id, name: d.plantId.name } : null,
        status: d.status,
        availability: d.availability,
        observed: count,
        expected,
        uptimePct: Math.min(100, Math.round((count / expected) * 1000) / 10)
      });
    }
    const avg = out.length ? out.reduce((s, x) => s + x.uptimePct, 0) / out.length : 0;
    res.json({ from, to, expectedReadings: expected, averageUptimePct: Math.round(avg * 10) / 10, devices: out });
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/overview — single-shot dashboard summary
exports.overview = async (req, res, next) => {
  try {
    const [plantsTotal, plantsByStatus, devicesTotal, devicesByAvail, openAlerts, unsafeStates, pendingTasks] =
      await Promise.all([
        Plant.countDocuments(),
        Plant.aggregate([{ $group: { _id: "$operationalStatus", n: { $sum: 1 } } }]),
        Device.countDocuments(),
        Device.aggregate([{ $group: { _id: "$availability", n: { $sum: 1 } } }]),
        Alert.countDocuments({ status: "OPEN" }),
        WaterQualityState.countDocuments({ category: "UNSAFE" }),
        MaintenanceTask.countDocuments({ status: { $in: ["ASSIGNED", "IN_PROGRESS"] } })
      ]);

    res.json({
      plants: { total: plantsTotal, byStatus: plantsByStatus },
      devices: {
        total: devicesTotal,
        byAvailability: devicesByAvail,
        availablePct: devicesTotal
          ? Math.round(
              ((devicesByAvail.find((x) => x._id === "AVAILABLE")?.n || 0) / devicesTotal) * 1000
            ) / 10
          : 0
      },
      openAlerts,
      unsafeStates,
      pendingTasks
    });
  } catch (err) {
    next(err);
  }
};
