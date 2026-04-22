const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const {
  getAlerts,
  ackAlert,
  resolveAlert
} = require("../controllers/alert.controller");

const router = express.Router();

// All alert routes require ADMIN role
router.use(requireRole('ADMIN'));

router.get("/", getAlerts);
router.patch("/:id/ack", ackAlert);
router.patch("/:id/resolve", resolveAlert);

module.exports = router;