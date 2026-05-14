const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const protect = require("../middleware/protect");
const {
  createTask,
  assignTask,
  getTasks,
  getMyTasks,
  getTask,
  startTask,
  addLog,
  getLogs,
  resolveTask
} = require("../controllers/maintenance.controller");

const router = express.Router();

// Maintainer-only routes registered first so `/mine` doesn't get shadowed by `/:id`.
router.get("/mine", requireRole("MAINTAINER"), getMyTasks);
router.patch("/:id/start", requireRole("MAINTAINER"), startTask);
router.post("/:id/logs", requireRole("MAINTAINER"), addLog);
router.post("/:id/resolve", requireRole("MAINTAINER"), resolveTask);

// Admin routes
router.post("/", requireRole("ADMIN"), createTask);
router.patch("/:id/assign", requireRole("ADMIN"), assignTask);
router.get("/", requireRole("ADMIN"), getTasks);

// Shared routes (admin or assigned maintainer); controller enforces permission.
router.get("/:id", protect, getTask);
router.get("/:id/logs", protect, getLogs);

module.exports = router;
