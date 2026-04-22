const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
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
maintainerRouter.use((req, res, next) => {
  if (req.user.role === 'ADMIN' || req.user.role === 'MAINTAINER') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied' });
});
maintainerRouter.get("/mine", getMyTasks);
maintainerRouter.patch("/:id/start", startTask);
maintainerRouter.post("/:id/logs", addLog);
maintainerRouter.post("/:id/resolve", resolveTask);

// Shared routes (admin or assigned maintainer)
router.get("/:id", getTask);
router.get("/:id/logs", getLogs);

// Mount sub-routers
router.use("/", adminRouter);
router.use("/", maintainerRouter);

module.exports = router;