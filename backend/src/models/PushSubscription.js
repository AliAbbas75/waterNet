const mongoose = require("mongoose");

/**
 * One browser's push endpoint. A user may have several — a desktop, a phone,
 * a second browser — and each is registered and revoked independently, so
 * turning notifications off on one device leaves the others alone.
 */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    // The push service URL is the identity of the subscription. Browsers hand
    // back the same endpoint for the same registration, so this is what keeps a
    // reinstall or a re-subscribe from piling up duplicates.
    endpoint: {
      type: String,
      required: true,
      unique: true
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    userAgent: { type: String, default: null },
    // Bumped whenever a send succeeds, so dead devices are visible.
    lastUsedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
