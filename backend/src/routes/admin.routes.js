const express = require("express");

const protect = require("../middleware/protect");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

// Admin-only endpoint used by the admin dashboard to validate session
// and fetch the current user context.
router.get(
  "/bootstrap",
  protect,
  requireRole("ADMIN", "SUPER_ADMIN"),
  (req, res) => {
    return res.json({ ok: true, user: req.user });
  }
);

module.exports = router;
