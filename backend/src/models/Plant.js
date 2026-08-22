const mongoose = require("mongoose");

const plantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    geo: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    operationalStatus: {
      type: String,
      // CLOSED (not OFFLINE) — a plant is a physical site that opens and closes;
      // "offline" reads as a connectivity fault, which is a device concern.
      enum: ['OPERATIONAL', 'MAINTENANCE', 'CLOSED'],
      default: 'OPERATIONAL'
    },
    operatingHours: {
      type: String, // e.g., "9:00-17:00" or JSON, optional
      default: null
    },
    // Usable storage for this plant's tank. Daily consumption is drawn down
    // against this figure and it refills at local midnight.
    tankCapacityLitres: {
      type: Number,
      default: 1000,
      min: 1
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plant", plantSchema);