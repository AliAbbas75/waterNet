const mongoose = require("mongoose");

const authChallengeSchema = new mongoose.Schema(
  {
    wallet: {
      type: String,
      required: true,
      index: true
    },
    message: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    },
    usedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuthChallenge", authChallengeSchema);
