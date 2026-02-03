const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    wallet: {
      type: String,
      unique: true,
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "maintainer", "public"],
      default: "public"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
