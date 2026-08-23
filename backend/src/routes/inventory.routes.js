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

// A manager owns restocking work orders, so they can read the stock levels the
// work is about. Changing stock — adding items, editing counts, deleting — is
// still an admin act: reading what is on the shelf and deciding what goes on it
// are different jobs.
router.get("/", requireRole('MANAGER'), getInventory);
router.get("/:id", requireRole('MANAGER'), getInventoryItem);

router.post("/", requireRole('ADMIN'), createInventoryItem);
router.put("/:id", requireRole('ADMIN'), updateInventoryItem);
router.delete("/:id", requireRole('ADMIN'), deleteInventoryItem);

module.exports = router;