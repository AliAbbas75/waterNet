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

// Admin routes
const adminRouter = express.Router();
adminRouter.use(requireRole('ADMIN'));
adminRouter.post("/", createTask);
adminRouter.patch("/:id/assign", assignTask);
adminRouter.get("/", getTasks);

// Maintainer routes (also allow ADMIN)
const maintainerRouter = express.Router();
maintainerRouter.use(requireRole('MAINTAINER'));
maintainerRouter.get("/mine", getMyTasks);
maintainerRouter.patch("/:id/start", startTask);
maintainerRouter.post("/:id/logs", addLog);
maintainerRouter.post("/:id/resolve", resolveTask);

// Shared routes (admin or assigned maintainer)
router.get("/:id", protect, getTask);
router.get("/:id/logs", protect, getLogs);

// Mount sub-routers
router.use("/", adminRouter);
router.use("/", maintainerRouter);

module.exports = router;