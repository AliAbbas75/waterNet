const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const {
  getPlants,
  getPlant,
  createPlant,
  updatePlant,
  deletePlant
} = require("../controllers/plant.controller");

const router = express.Router();

// All plant routes require ADMIN role
router.use(requireRole('ADMIN'));

router.get("/", getPlants);
router.get("/:id", getPlant);
router.post("/", createPlant);
router.put("/:id", updatePlant);
router.delete("/:id", deletePlant);

module.exports = router;