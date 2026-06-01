const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    address: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    encryptedPrivateKey: {
      type: String,
      required: true
    },
    keyVersion: {
      type: Number,
      default: 1
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

walletSchema.pre("validate", function (next) {
  if (this.address) {
    this.address = String(this.address).toLowerCase();
  }
  next();
});

module.exports = mongoose.model("Wallet", walletSchema);
