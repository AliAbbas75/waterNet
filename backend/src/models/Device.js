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
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Device", deviceSchema);