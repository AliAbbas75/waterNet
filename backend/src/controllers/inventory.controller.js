const InventoryItem = require("../models/InventoryItem");
const Alert = require("../models/Alert");

exports.getInventory = async (req, res, next) => {
  try {
    const { category, status, lowStock } = req.query;
    let query = {};

    if (category) query.category = category;
    if (status) query.status = status;
    if (lowStock === 'true') {
      query.$expr = { $lt: ['$quantity', '$reorderThreshold'] };
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
      return res.status(404).json({ error: 'Inventory item not found' });
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
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const item = new InventoryItem({
      category,
      name,
      status: status || 'AVAILABLE',
      quantity,
      reorderThreshold: reorderThreshold || 0,
      unit: unit || 'pieces'
    });

    await item.save();
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
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    // Check for low stock alert
    if (item.quantity < item.reorderThreshold) {
      // Check if alert already exists
      const existingAlert = await Alert.findOne({
        type: 'LOW_INVENTORY',
        inventoryItemId: item._id,
        status: { $in: ['OPEN', 'ACK'] }
      });

      if (!existingAlert) {
        await Alert.create({
          type: 'LOW_INVENTORY',
          severity: 'WARN',
          inventoryItemId: item._id,
          message: `Low stock for ${item.name}: ${item.quantity} remaining (threshold: ${item.reorderThreshold})`
        });
      }
    }

    res.json({ item });
  } catch (err) {
    next(err);
  }
};

exports.deleteInventoryItem = async (req, res, next) => {
  try {
    const item = await InventoryItem.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json({ message: 'Inventory item deleted' });
  } catch (err) {
    next(err);
  }
};