const mongoose = require("mongoose");

const waterQualityStateSchema = new mongoose.Schema(
  {
    plantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      required: true
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true
    },
    category: {
      type: String,
      enum: ['SAFE', 'WARNING', 'UNSAFE', 'NO_DATA'],
      required: true
    },
    reasons: [{
      parameter: { type: String, required: true },
      value: { type: Number, required: true },
      threshold: { type: String, required: true }, // 'safe', 'warn', 'unsafe'
      message: { type: String, required: true }
    }],
    lastEvaluatedAt: {
      type: Date,
      required: true
    }
  },
  { timestamps: true }
);

// Unique per plant-device
waterQualityStateSchema.index({ plantId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model("WaterQualityState", waterQualityStateSchema);