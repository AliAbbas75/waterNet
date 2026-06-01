const express = require("express");

const protect = require("../middleware/protect");
const { requireRole } = require("../middleware/roleGuard");
const { z, validateBody } = require("../middleware/validate");
const { rateLimit } = require("../middleware/rateLimit");
const adminController = require("../controllers/admin.controller");
const auditController = require("../controllers/audit.controller");

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

const registerUserSchema = z.object({
  email: z.string().min(1),
  role: z.enum(["PUBLIC", "MAINTAINER", "ADMIN", "SUPER_ADMIN"]).optional(),
  displayName: z.string().min(1).optional()
});

const inviteSchema = z.object({
  email: z.string().min(1),
  role: z.enum(["MAINTAINER", "ADMIN"])
});

router.post(
  "/register-user",
  protect,
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateBody(registerUserSchema),
  adminController.registerUser
);

router.post(
  "/invites",
  protect,
  requireRole("ADMIN", "SUPER_ADMIN"),
  rateLimit({ windowMs: 10 * 60 * 1000, max: 10, keyPrefix: "admin-invite" }),
  validateBody(inviteSchema),
  adminController.createInvite
);

router.get(
  "/audit-logs",
  protect,
  requireRole("ADMIN", "SUPER_ADMIN"),
  auditController.listAuditLogs
);

module.exports = router;
