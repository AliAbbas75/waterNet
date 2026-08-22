const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const { listUsers, getUser, updateRole, toggleActive } = require("../controllers/user.controller");

const router = express.Router();

// Reading the directory is an operational need, not user management: an ADMIN
// has to list maintainers to assign a task to one.
router.get("/", requireRole("ADMIN"), listUsers);
router.get("/:id", requireRole("ADMIN"), getUser);

// Mutating roles or account state is privilege management and is SUPER_ADMIN
// only — an ADMIN able to call these could promote itself to SUPER_ADMIN.
// requireRole is hierarchical, so this admits SUPER_ADMIN and nothing below.
router.patch("/:id/role", requireRole("SUPER_ADMIN"), updateRole);
router.patch("/:id/active", requireRole("SUPER_ADMIN"), toggleActive);

module.exports = router;
