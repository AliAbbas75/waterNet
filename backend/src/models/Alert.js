const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'QUALITY_UNSAFE',
        'AVAILABILITY_CHANGE',
        'DEVICE_OFFLINE',
        // A device cycling between up and down is a different fault from one
        // that is simply down, and needs a different response.
        'DEVICE_FLAPPING',
        'LOW_INVENTORY'
      ],
      required: true
    },
    severity: {
      type: String,
      // The ladder decides behaviour, not just colour: it sets the triage
      // deadline and whether an alert raises a ticket at all. MAJOR replaces
      // the old WARN so there is room between "needs attention today" (MINOR)
      // and "monitoring is blind or a plant is degraded" (MAJOR).
      enum: ['INFO', 'MINOR', 'MAJOR', 'CRITICAL'],
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
      // CLEARED_PENDING_REVIEW: the underlying condition stopped, but the alert
      // is not closed because a person still has to record what was done. Used
      // for alerts whose severity means the response matters even after the
      // symptom disappears — a water-quality breach does not become a non-event
      // just because the next reading came back inside limits.
      enum: ['OPEN', 'ACK', 'CLEARED_PENDING_REVIEW', 'RESOLVED'],
      default: 'OPEN'
    },
    // When the machine-observed condition stopped, as distinct from when a
    // human closed the alert. On an auto-cleared alert these differ, and the
    // gap between them is the response time.
    conditionClearedAt: {
      type: Date,
      default: null
    },
    // The work order this alert raised, when its policy calls for one. Stored
    // so the alert view can link forward without a reverse scan of tasks.
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenanceTask',
      default: null
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