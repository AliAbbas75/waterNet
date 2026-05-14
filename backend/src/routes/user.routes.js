const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const { listUsers, getUser, updateRole, toggleActive } = require("../controllers/user.controller");

const router = express.Router();

router.use(requireRole("ADMIN"));

router.get("/", listUsers);
router.get("/:id", getUser);
router.patch("/:id/role", updateRole);
router.patch("/:id/active", toggleActive);

module.exports = router;
