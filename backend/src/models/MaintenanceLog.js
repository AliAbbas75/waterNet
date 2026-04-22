const mongoose = require("mongoose");

const maintenanceLogSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenanceTask',
      required: true,
      index: true
    },
    authorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    note: {
      type: String,
      required: true
    },
    structuredFields: {
      type: mongoose.Schema.Types.Mixed, // optional additional data
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaintenanceLog", maintenanceLogSchema);