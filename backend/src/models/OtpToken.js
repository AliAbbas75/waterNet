const mongoose = require("mongoose");

const otpTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      index: true
    },
    codeHash: {
      type: String,
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    consumedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OtpToken", otpTokenSchema);
