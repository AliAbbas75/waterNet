const express = require("express");
const { requireRole } = require("../middleware/roleGuard");
const {
  getInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
} = require("../controllers/inventory.controller");

const router = express.Router();

// All inventory routes require ADMIN role
router.use(requireRole('ADMIN'));

router.get("/", getInventory);
router.get("/:id", getInventoryItem);
router.post("/", createInventoryItem);
router.put("/:id", updateInventoryItem);
router.delete("/:id", deleteInventoryItem);

module.exports = router;