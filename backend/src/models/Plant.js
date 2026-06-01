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
      enum: ['OPERATIONAL', 'MAINTENANCE', 'OFFLINE'],
      default: 'OPERATIONAL'
    },
    operatingHours: {
      type: String, // e.g., "9:00-17:00" or JSON, optional
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plant", plantSchema);