const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const {
  qualityTrends,
  maintenancePerformance,
  uptime,
  overview
} = require("../controllers/reports.controller");

const router = express.Router();

router.use(requireRole("ADMIN"));

router.get("/overview", overview);
router.get("/quality/trends", qualityTrends);
router.get("/maintenance/performance", maintenancePerformance);
router.get("/uptime", uptime);

module.exports = router;
