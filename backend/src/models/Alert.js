const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['QUALITY_UNSAFE', 'AVAILABILITY_CHANGE', 'DEVICE_OFFLINE', 'LOW_INVENTORY'],
      required: true
    },
    severity: {
      type: String,
      enum: ['INFO', 'WARN', 'CRITICAL'],
      default: 'INFO'
    },
    plantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      default: null
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      default: null
    },
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      default: null
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['OPEN', 'ACK', 'RESOLVED'],
      default: 'OPEN'
    },
    ackAt: {
      type: Date,
      default: null
    },
    ackByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolvedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Alert", alertSchema);