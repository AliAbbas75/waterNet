const mongoose = require("mongoose");
const TelemetryReading = require("../models/TelemetryReading");
const MaintenanceTask = require("../models/MaintenanceTask");
const Device = require("../models/Device");
const Plant = require("../models/Plant");
const WaterQualityState = require("../models/WaterQualityState");
const Alert = require("../models/Alert");
const { buildQualityReport } = require("../services/report.service");
const { renderPdf, renderDocx } = require("../services/reportDoc.service");

const PARAM_KEYS = ["pH", "turbidity", "TDS", "flowRate"];

// ?plantIds=a,b,c — repeated params work too, so the client can use either.
function parsePlantIds(query) {
  const raw = query.plantIds ?? query.plantId;
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : String(raw).split(","))
    .map((s) => String(s).trim())
    .filter(Boolean);
}

// An empty selection legitimately means "the whole network", so a malformed id
// must be rejected rather than filtered out — dropping it would silently widen
// a single-plant request into a network-wide one.
function readScope(query) {
  const plantIds = parsePlantIds(query);
  const invalid = plantIds.find((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalid) {
    const err = new Error(`Invalid plant id: ${invalid}`);
    err.statusCode = 400; // the app's error handler reads statusCode, not status
    throw err;
  }
  return plantIds;
}

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
          TDS: { $avg: "$readings.TDS" },
          flowRate: { $avg: "$readings.flowRate" },
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

// GET /api/reports/export?type=quality|maintenance|uptime&from=&to=&bucket=
exports.exportCsv = async (req, res, next) => {
  try {
    const { type, bucket } = req.query;
    const { from, to } = parseRange(req);

    let rows = [];
    let filename = `waternet-${type}-${from.toISOString().slice(0, 10)}.csv`;

    if (type === "quality") {
      const match = { timestamp: { $gte: from, $lte: to }, readings: { $exists: true, $ne: null } };
      if (req.query.plantId) {
        const mongoose = require("mongoose");
        match.plantId = new mongoose.Types.ObjectId(req.query.plantId);
      }
      const b = bucket === "hour" ? "hour" : "day";
      const groupKey =
        b === "hour"
          ? { y: { $year: "$timestamp" }, m: { $month: "$timestamp" }, d: { $dayOfMonth: "$timestamp" }, h: { $hour: "$timestamp" } }
          : { y: { $year: "$timestamp" }, m: { $month: "$timestamp" }, d: { $dayOfMonth: "$timestamp" } };
      const agg = await TelemetryReading.aggregate([
        { $match: match },
        { $group: { _id: groupKey, ts: { $min: "$timestamp" }, pH: { $avg: "$readings.pH" }, turbidity: { $avg: "$readings.turbidity" }, TDS: { $avg: "$readings.TDS" }, flowRate: { $avg: "$readings.flowRate" }, count: { $sum: 1 } } },
        { $sort: { ts: 1 } }
      ]);
      rows = [["timestamp", "pH", "turbidity", "TDS", "flowRate", "count"]];
      for (const p of agg) {
        rows.push([p.ts?.toISOString() ?? "", p.pH?.toFixed(3) ?? "", p.turbidity?.toFixed(3) ?? "", p.TDS?.toFixed(3) ?? "", p.flowRate?.toFixed(3) ?? "", p.count]);
      }
    } else if (type === "maintenance") {
      const tasks = await MaintenanceTask.find({ createdAt: { $gte: from, $lte: to } })
        .populate("assignedToUserId", "display_name email");
      rows = [["taskId", "title", "status", "assignedTo", "createdAt", "resolvedAt", "resolutionMinutes"]];
      for (const t of tasks) {
        const mins = t.status === "RESOLVED" && t.resolvedAt
          ? Math.round((new Date(t.resolvedAt) - new Date(t.assignedAt)) / 60000)
          : "";
        const name = t.assignedToUserId ? (t.assignedToUserId.display_name || t.assignedToUserId.email) : "";
        rows.push([t._id, t.title, t.status, name, t.createdAt?.toISOString() ?? "", t.resolvedAt?.toISOString() ?? "", mins]);
      }
    } else if (type === "uptime") {
      const devices = await Device.find({ disabled: false }).populate("plantId", "name");
      const expected = Math.max(1, Math.floor((to - from) / (15 * 60 * 1000)));
      rows = [["deviceId", "plant", "status", "availability", "observed", "expected", "uptimePct"]];
      for (const d of devices) {
        const count = await TelemetryReading.countDocuments({
          $or: [{ deviceRef: d._id }, { deviceId: d.deviceId }],
          timestamp: { $gte: from, $lte: to },
          readings: { $exists: true, $ne: null }
        });
        const pct = Math.min(100, Math.round((count / expected) * 1000) / 10);
        rows.push([d.deviceId, d.plantId?.name ?? "", d.status, d.availability, count, expected, pct]);
      }
    } else {
      return res.status(400).json({ error: "type must be quality, maintenance, or uptime" });
    }

    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

// Work that still owes somebody something. Mirrors ticket.service's list.
const LIVE_TASK_STATUSES = ["TRIAGE", "ASSIGNED", "IN_PROGRESS", "BLOCKED"];

// GET /api/reports/quality/stats?plantIds=&range=24h|7d|30d|365d&mode=
// Drives the in-app report preview.
exports.qualityStats = async (req, res, next) => {
  try {
    const report = await buildQualityReport({
      plantIds: readScope(req.query),
      rangeKey: req.query.range,
      mode: req.query.mode
    });
    res.json(report);
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/quality/document?plantIds=&range=&mode=&format=pdf|docx
// Same payload as the preview, rendered as a document.
exports.qualityDocument = async (req, res, next) => {
  try {
    const format = String(req.query.format || "pdf").toLowerCase();
    if (format !== "pdf" && format !== "docx") {
      return res.status(400).json({ error: "format must be pdf or docx" });
    }

    const report = await buildQualityReport({
      plantIds: readScope(req.query),
      rangeKey: req.query.range,
      mode: req.query.mode
    });

    const { buffer, filename, contentType } = await (format === "pdf"
      ? renderPdf(report)
      : renderDocx(report));

    // inline lets the viewer render it in an iframe; attachment forces a save.
    const disposition = req.query.disposition === "attachment" ? "attachment" : "inline";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/overview — single-shot dashboard summary
exports.overview = async (req, res, next) => {
  try {
    const [
      plantsTotal,
      plantsByStatus,
      devicesTotal,
      devicesByAvail,
      openAlerts,
      unsafeStates,
      tasksByStatus,
      alertsBySeverity,
      workByType,
      overdueTriage,
      advisories,
      uncovered
    ] = await Promise.all([
      Plant.countDocuments(),
      Plant.aggregate([{ $group: { _id: "$operationalStatus", n: { $sum: 1 } } }]),
      Device.countDocuments(),
      Device.aggregate([{ $group: { _id: "$availability", n: { $sum: 1 } } }]),
      Alert.countDocuments({ status: { $in: ["OPEN", "ACK", "CLEARED_PENDING_REVIEW"] } }),
      WaterQualityState.countDocuments({ category: "UNSAFE" }),
      MaintenanceTask.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Alert.aggregate([
        { $match: { status: { $in: ["OPEN", "ACK", "CLEARED_PENDING_REVIEW"] } } },
        { $group: { _id: "$severity", n: { $sum: 1 } } }
      ]),
      // What kind of work is live, and where. This is the "which plant is
      // undergoing what" question the dashboard could not answer.
      MaintenanceTask.aggregate([
        { $match: { status: { $in: LIVE_TASK_STATUSES } } },
        {
          $group: {
            _id: { plantId: "$plantId", severity: "$severity" },
            n: { $sum: 1 }
          }
        }
      ]),
      // An unrouted critical ticket past its triage deadline is itself an
      // incident, so it gets its own number rather than hiding inside "pending".
      MaintenanceTask.countDocuments({
        status: "TRIAGE",
        triageDueAt: { $ne: null, $lt: new Date() }
      }),
      Plant.countDocuments({ "advisory.active": true }),
      Plant.countDocuments({ coveringMaintainerId: null })
    ]);

    const byStatus = tasksByStatus.reduce((acc, r) => {
      acc[r._id] = r.n;
      return acc;
    }, {});

    const phase = (statuses) => statuses.reduce((n, s) => n + (byStatus[s] || 0), 0);

    res.json({
      plants: { total: plantsTotal, byStatus: plantsByStatus, advisories, uncovered },
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
      alertsBySeverity,
      unsafeStates,
      work: {
        byStatus,
        pending: phase(["TRIAGE", "ASSIGNED"]),
        inProgress: phase(["IN_PROGRESS", "BLOCKED"]),
        completed: byStatus.RESOLVED || 0,
        // The two that need a person to act rather than a person to wait.
        unrouted: byStatus.TRIAGE || 0,
        blocked: byStatus.BLOCKED || 0,
        overdueTriage,
        byPlant: workByType
      },
      // Retained so an older bundle served from cache does not read zero work.
      pendingTasks: phase(["TRIAGE", "ASSIGNED", "IN_PROGRESS", "BLOCKED"])
    });
  } catch (err) {
    next(err);
  }
};
