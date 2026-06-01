const mongoose = require("mongoose");

const maintenanceTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
      default: 'ASSIGNED'
    },
    assignedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
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
    externalRef: {
      type: mongoose.Schema.Types.Mixed, // e.g., { type, id }
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
    },
    resolutionSummary: {
      type: String,
      default: null
    },
    materials: [{
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
      quantity: { type: Number, required: true },
      name: { type: String, required: true } // denormalize for history
    }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaintenanceTask", maintenanceTaskSchema);