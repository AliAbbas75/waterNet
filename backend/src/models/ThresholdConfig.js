const mongoose = require("mongoose");

const thresholdConfigSchema = new mongoose.Schema(
  {
    plantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      default: null // null for global default
    },
    parameter: {
      type: String,
      required: true, // 'pH', 'turbidity', 'temperature', 'TDS'
      enum: ['pH', 'turbidity', 'temperature', 'TDS']
    },
    safeMin: {
      type: Number,
      required: true
    },
    safeMax: {
      type: Number,
      required: true
    },
    warnMin: {
      type: Number,
      default: null
    },
    warnMax: {
      type: Number,
      default: null
    },
    unsafeMin: {
      type: Number,
      default: null
    },
    unsafeMax: {
      type: Number,
      default: null
    }
  },
  { timestamps: true }
);

// Ensure unique per plant and parameter
thresholdConfigSchema.index({ plantId: 1, parameter: 1 }, { unique: true });

module.exports = mongoose.model("ThresholdConfig", thresholdConfigSchema);