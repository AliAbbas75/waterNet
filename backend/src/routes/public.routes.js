const express = require("express");
const protect = require("../middleware/protect");
const { requireRole } = require("../middleware/roleGuard");
const {
  listNearby,
  plantStatus,
  createReport,
  myReports,
  adminListReports,
  adminUpdateReport,
  chainProof
} = require("../controllers/public.controller");

const router = express.Router();

// Public (no auth required)
router.get("/plants/nearby", listNearby);
router.get("/plants/:id/status", plantStatus);
router.get("/chain-proof", chainProof);

// Authenticated public users (any logged-in user) can submit and view their reports.
router.post("/reports", protect, createReport);
router.get("/reports/mine", protect, myReports);

// Admin endpoints for managing reports.
router.get("/reports", requireRole("ADMIN"), adminListReports);
router.patch("/reports/:id", requireRole("ADMIN"), adminUpdateReport);

module.exports = router;
