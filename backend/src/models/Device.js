const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    plantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      default: null
    },
    installDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'INSTALLED', 'FAULTY', 'MAINTENANCE'],
      default: 'AVAILABLE'
    },
    firmwareVersion: {
      type: String,
      default: null
    },
    lastSeenAt: {
      type: Date,
      default: null
    },
    disabled: {
      type: Boolean,
      default: false
    },
    availability: {
      type: String,
      enum: ['AVAILABLE', 'UNAVAILABLE'],
      default: 'UNAVAILABLE'
    },
    // How often this device is expected to report. Offline detection derives
    // its grace period from this rather than a fixed wall-clock number: the
    // fleet spans a 3-second ESP32 and 30-minute sensors, so one global
    // threshold would either miss real outages or flag healthy devices.
    expectedIntervalSeconds: {
      type: Number,
      default: 60,
      min: 1
    },
    // Rolling record of availability flips, used to tell a device that is down
    // from one that is unstable. Pruned to the detection window on every write,
    // so it stays a handful of entries rather than growing without bound.
    availabilityFlips: {
      type: [Date],
      default: []
    },
    flappingSince: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Device", deviceSchema);