const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ["MAINTAINER", "ADMIN"],
      required: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    usedAt: {
      type: Date,
      default: null
    },
    usedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

inviteSchema.pre("validate", function (next) {
  if (this.email) {
    this.email = String(this.email).trim().toLowerCase();
  }
  next();
});

inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Invite", inviteSchema);
