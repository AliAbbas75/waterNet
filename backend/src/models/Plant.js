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
    },
    // Set the moment a breach is confirmed, cleared when its ticket resolves.
    // Deliberately separate from operationalStatus: there is a gap between
    // knowing the water is unsafe and someone physically reaching the site, and
    // during that gap both facts are true — the plant is open, the water is not
    // safe to drink. Overloading one field would force us to lie about one.
    advisory: {
      active: { type: Boolean, default: false },
      since: { type: Date, default: null },
      reason: { type: String, default: null },
      alertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', default: null }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plant", plantSchema);