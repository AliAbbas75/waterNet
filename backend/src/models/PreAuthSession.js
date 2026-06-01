const mongoose = require("mongoose");

const preAuthSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
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

preAuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PreAuthSession", preAuthSessionSchema);
