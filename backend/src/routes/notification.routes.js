const express = require("express");
const protect = require("../middleware/protect");
const { requireRole } = require("../middleware/roleGuard");
const { rateLimit } = require("../middleware/rateLimit");
const notifications = require("../controllers/notification.controller");

const router = express.Router();

// Every route here acts on the caller's own account, so authentication is the
// only gate — the catalog already limits what each role can see or choose.
router.get("/config", protect, notifications.getConfig);
router.put("/preferences", protect, notifications.updatePreferences);

router.get("/devices", protect, notifications.listDevices);
router.post("/subscribe", protect, notifications.subscribe);
router.delete("/subscribe", protect, notifications.unsubscribe);

router.post(
  "/test",
  protect,
  rateLimit({ windowMs: 5 * 60 * 1000, max: 5, keyPrefix: "notify-test" }),
  notifications.sendTest
);

// Broadcasting reaches other people, so it is not a self-service route.
router.post(
  "/broadcast",
  requireRole("ADMIN"),
  rateLimit({ windowMs: 10 * 60 * 1000, max: 10, keyPrefix: "notify-broadcast" }),
  notifications.broadcast
);

module.exports = router;
