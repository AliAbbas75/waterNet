const mongoose = require("mongoose");

const inventoryItemSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true // e.g., 'device', 'sensor', 'filter unit'
    },
    name: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'INSTALLED', 'FAULTY', 'MAINTENANCE'],
      default: 'AVAILABLE'
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    reorderThreshold: {
      type: Number,
      default: 0
    },
    unit: {
      type: String,
      default: 'pieces' // e.g., 'pieces', 'liters'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);