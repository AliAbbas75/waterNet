const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const {
  getAlerts,
  ackAlert,
  dispatchAlert,
  resolveAlert
} = require("../controllers/alert.controller");

const router = express.Router();

router.get("/", requireRole('MAINTAINER'), getAlerts);

// A maintainer may acknowledge an alert on work they hold — it opens or reuses
// the work order and records that someone has eyes on it.
router.patch("/:id/ack", requireRole('MAINTAINER'), ackAlert);

// Assigning work and closing an alert without doing the work are both admin
// acts. A maintainer finishes an alert by resolving the ticket they were given,
// which is the path that produces a record of what was actually done.
router.patch("/:id/dispatch", requireRole('ADMIN'), dispatchAlert);
router.patch("/:id/resolve", requireRole('ADMIN'), resolveAlert);

module.exports = router;
