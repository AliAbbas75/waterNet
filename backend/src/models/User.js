const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    wallet_address: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN", "MAINTAINER", "PUBLIC"],
      default: "PUBLIC",
      index: true
    },
    email: {
      type: String,
      default: null
    },
    provider: {
      type: String,
      default: null
    },
    provider_user_id: {
      type: String,
      default: null
    },
    display_name: {
      type: String,
      default: null
    },
    avatar_url: {
      type: String,
      default: null
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'MAINTAINER', 'PUBLIC'],
      default: 'PUBLIC'
    },
    last_login_at: {
      type: Date,
      default: null
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

userSchema.pre("validate", function (next) {
  if (this.wallet_address) {
    this.wallet_address = String(this.wallet_address).toLowerCase();
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
