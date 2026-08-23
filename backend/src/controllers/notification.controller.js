const User = require("../models/User");
const PushSubscription = require("../models/PushSubscription");
const { notify, pushToUser, pushReady, publicKey } = require("../services/notification.service");
const {
  CHANNELS,
  catalogForRole,
  effectivePreferences,
  isEligible
} = require("../services/notificationCatalog");

// GET /api/notifications/config — what this user may receive, and whether the
// server can push at all. The client needs the VAPID key to subscribe.
exports.getConfig = async (req, res, next) => {
  try {
    res.json({
      pushEnabled: pushReady(),
      vapidPublicKey: publicKey(),
      channels: CHANNELS,
      categories: catalogForRole(req.user.role),
      preferences: effectivePreferences(req.user)
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/notifications/preferences
// Body: { preferences: { CATEGORY: { push: bool, email: bool } } }
exports.updatePreferences = async (req, res, next) => {
  try {
    const incoming = req.body?.preferences;
    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({ error: "preferences object is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.notificationPrefs) user.notificationPrefs = new Map();

    for (const [category, value] of Object.entries(incoming)) {
      // A preference may only narrow what the role already allows. Silently
      // ignoring an ineligible category would let the UI drift out of sync, so
      // this is an error the caller can see.
      if (!isEligible(user.role, category)) {
        return res.status(400).json({ error: `Not eligible for category: ${category}` });
      }
      const current = user.notificationPrefs.get(category) || {};
      const next = { ...current };
      for (const channel of CHANNELS) {
        if (value && typeof value[channel] === "boolean") next[channel] = value[channel];
      }
      user.notificationPrefs.set(category, next);
    }

    user.markModified("notificationPrefs");
    await user.save();

    res.json({ preferences: effectivePreferences(user) });
  } catch (err) {
    next(err);
  }
};

// POST /api/notifications/subscribe — register one browser's push endpoint.
exports.subscribe = async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: "endpoint and keys.p256dh/keys.auth are required" });
    }

    // Upsert on endpoint: re-subscribing the same browser must not create a
    // second row, and an endpoint that moved to another account must follow it.
    const sub = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        userId: req.user._id,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        userAgent: req.headers["user-agent"] || null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ ok: true, id: sub._id });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/notifications/subscribe — this device opts out.
exports.unsubscribe = async (req, res, next) => {
  try {
    const endpoint = req.body?.endpoint || req.query.endpoint;
    if (!endpoint) return res.status(400).json({ error: "endpoint is required" });
    const result = await PushSubscription.deleteOne({ endpoint, userId: req.user._id });
    res.json({ ok: true, removed: result.deletedCount });
  } catch (err) {
    next(err);
  }
};

// GET /api/notifications/devices — this user's registered devices.
exports.listDevices = async (req, res, next) => {
  try {
    const devices = await PushSubscription.find({ userId: req.user._id })
      .select("endpoint userAgent lastUsedAt createdAt")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ devices });
  } catch (err) {
    next(err);
  }
};

// POST /api/notifications/test — send a push to the caller's own devices, so a
// user can confirm the whole chain works without waiting for a real alert.
exports.sendTest = async (req, res, next) => {
  try {
    if (!pushReady()) {
      return res.status(503).json({ error: "Push is not configured on this server" });
    }
    const result = await pushToUser(req.user._id, {
      title: "WaterNet test notification",
      body: "Push is working on this device.",
      url: "/",
      category: "TEST"
    });
    if (!result.sent) {
      return res.status(404).json({
        error: "No registered devices for this account",
        pruned: result.pruned
      });
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
};

// POST /api/notifications/broadcast — admin-authored message to a set of roles.
// This is the "messages and updates" half: not everything worth telling people
// comes from an alert.
exports.broadcast = async (req, res, next) => {
  try {
    const { title, body, category = "PLANT_AVAILABILITY", roles, url } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }
    const result = await notify({
      category,
      audience: { roles: Array.isArray(roles) && roles.length ? roles : undefined },
      title,
      body,
      url: url || null,
      meta: { broadcastBy: String(req.user._id) }
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
};
