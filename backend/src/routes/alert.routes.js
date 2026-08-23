const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const {
  getAlerts,
  dispatchAlert,
  resolveAlert
} = require("../controllers/alert.controller");

const router = express.Router();

router.get("/", requireRole('MAINTAINER'), getAlerts);

// There is no acknowledge. An alert is answered by giving it to somebody or by
// closing it with a reason — a button that only marked an alert as seen let
// incidents leave the queue with nobody doing anything about them.
//
// Assigning work and closing an alert without doing the work are both admin
// acts. Staff finish an alert by resolving the ticket they were given, which is
// the path that produces a record of what was actually done.
router.patch("/:id/dispatch", requireRole('ADMIN'), dispatchAlert);
router.patch("/:id/resolve", requireRole('ADMIN'), resolveAlert);

module.exports = router;
