const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const {
  qualityTrends,
  qualityStats,
  qualityDocument,
  maintenancePerformance,
  uptime,
  overview,
  exportCsv
} = require("../controllers/reports.controller");

const router = express.Router();

router.use(requireRole("ADMIN"));

router.get("/overview", overview);
router.get("/export", exportCsv);
router.get("/quality/trends", qualityTrends);
router.get("/quality/stats", qualityStats);
router.get("/quality/document", qualityDocument);
router.get("/maintenance/performance", maintenancePerformance);
router.get("/uptime", uptime);

module.exports = router;
