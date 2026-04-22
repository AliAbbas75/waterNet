const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const {
  getDevices,
  getDevice,
  createDevice,
  updateDevice,
  installDevice,
  uninstallDevice,
  deleteDevice,
  getDeviceReadings
} = require("../controllers/device.controller");

const router = express.Router();

// All device routes require ADMIN role
router.use(requireRole('ADMIN'));

router.get("/", getDevices);
router.get("/:id", getDevice);
router.get("/:id/readings", getDeviceReadings);
router.post("/", createDevice);
router.put("/:id", updateDevice);
router.patch("/:id/install", installDevice);
router.patch("/:id/uninstall", uninstallDevice);
router.delete("/:id", deleteDevice);

module.exports = router;