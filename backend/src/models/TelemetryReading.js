const mongoose = require("mongoose");

const telemetryReadingSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true
    },
    plantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      default: null,
      index: true
    },
    timestamp: {
      type: Date,
      required: true,
      index: true
    },
    readings: {
      pH: { type: Number, default: null },
      turbidity: { type: Number, default: null },
      temperature: { type: Number, default: null },
      TDS: { type: Number, default: null }
    },
    health: {
      uptime: { type: Number, default: null }, // seconds
      connectivityStatus: { type: String, default: null }
    },
    ingestMeta: {
      sourceIP: { type: String, default: null },
      protocol: { type: String, default: 'MQTT' },
      schemaVersion: { type: String, required: true }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("TelemetryReading", telemetryReadingSchema);