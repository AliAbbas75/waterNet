const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const {
  getAlerts,
  ackAlert,
  resolveAlert
} = require("../controllers/alert.controller");

const router = express.Router();

router.get("/", requireRole('ADMIN'), getAlerts);
router.patch("/:id/ack", requireRole('MAINTAINER'), ackAlert);
router.patch("/:id/resolve", requireRole('MAINTAINER'), resolveAlert);

module.exports = router;