const mongoose = require("mongoose");

const authChallengeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    nonce: {
      type: String,
      required: true
    },
    usedAt: {
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

authChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AuthChallenge", authChallengeSchema);
