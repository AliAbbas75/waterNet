const InventoryItem = require("../models/InventoryItem");
const Alert = require("../models/Alert");
const { emit: socketEmit } = require("../services/socket.service");
const { notifyAdminsOfAlert } = require("../services/alert.notification.service");
const {
  checkLowStock,
  autoResolveIfRestocked,
  resolveAlertsForDeletedItem
} = require("../services/inventory.service");

exports.getInventory = async (req, res, next) => {
  try {
    const { category, status, lowStock } = req.query;
    let query = {};

    if (category) query.category = category;
    if (status) query.status = status;
    if (lowStock === "true") {
      query.$expr = { $lt: ["$quantity", "$reorderThreshold"] };
    }

    const items = await InventoryItem.find(query).sort({ category: 1, name: 1 });
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

exports.getInventoryItem = async (req, res, next) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    res.json({ item });
  } catch (err) {
    next(err);
  }
};

exports.createInventoryItem = async (req, res, next) => {
  try {
    const { category, name, status, quantity, reorderThreshold, unit } = req.body;

    if (!category || !name || quantity === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const item = new InventoryItem({
      category,
      name,
      status: status || "AVAILABLE",
      quantity,
      reorderThreshold: reorderThreshold || 0,
      unit: unit || "pieces"
    });

    await item.save();

    // Fire alert immediately if starting below threshold
    await checkLowStock(item);

    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
};

exports.updateInventoryItem = async (req, res, next) => {
  try {
    const { category, name, status, quantity, reorderThreshold, unit } = req.body;

    const item = await InventoryItem.findByIdAndUpdate(
      req.params.id,
      { category, name, status, quantity, reorderThreshold, unit },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    if (item.quantity < item.reorderThreshold) {
      await checkLowStock(item);
    } else {
      // Quantity is now at or above threshold — resolve any open alert
      await autoResolveIfRestocked(item);
    }

    res.json({ item });
  } catch (err) {
    next(err);
  }
};

exports.deleteInventoryItem = async (req, res, next) => {
  try {
    // Resolve open alerts before removing the item so no orphaned refs remain
    await resolveAlertsForDeletedItem(req.params.id);

    const item = await InventoryItem.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    res.json({ message: "Inventory item deleted" });
  } catch (err) {
    next(err);
  }
};
