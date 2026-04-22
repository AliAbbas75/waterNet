const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const {
  evaluate,
  getPlantState,
  getThresholds,
  createThreshold,
  updateThreshold,
  deleteThreshold
} = require("../controllers/analysis.controller");

const router = express.Router();

// Public or maintainer read for plant state
router.get("/plants/:id/state", getPlantState);

// Admin for thresholds
const adminRouter = express.Router();
adminRouter.use(requireRole('ADMIN'));
adminRouter.post("/evaluate", evaluate);
adminRouter.get("/thresholds", getThresholds);
adminRouter.post("/thresholds", createThreshold);
adminRouter.put("/thresholds/:id", updateThreshold);
adminRouter.delete("/thresholds/:id", deleteThreshold);

router.use("/", adminRouter);

module.exports = router;