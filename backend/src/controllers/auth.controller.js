const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getThirdwebMe } = require("../config/thirdweb");

function requireJwtSecret() {
  if (!process.env.JWT_SECRET) {
    const err = new Error("Missing JWT_SECRET");
    err.statusCode = 500;
    throw err;
  }
  return process.env.JWT_SECRET;
}

exports.login = async (req, res, next) => {
  try {
    const { token, walletAddress } = req.body || {};

    if (!token) {
      return res
        .status(400)
        .json({ ok: false, error: "token is required", requestId: req.requestId });
    }
    if (!walletAddress) {
      return res
        .status(400)
        .json({ ok: false, error: "walletAddress is required", requestId: req.requestId });
    }

    const walletLower = String(walletAddress).toLowerCase();

    // Verify Thirdweb token and fetch user identity
    const clientIdFromHeader =
      req.headers["x-client-id"] ||
      req.headers["x-thirdweb-client-id"] ||
      req.headers["thirdweb-client-id"];

    const me = await getThirdwebMe(token, {
      clientId: typeof clientIdFromHeader === "string" ? clientIdFromHeader : undefined
    });

    const thirdwebWallet = (
      me?.address ||
      me?.walletAddress ||
      me?.wallet_address ||
      me?.wallet?.address ||
      me?.wallet?.walletAddress ||
      me?.wallets?.[0]?.address ||
      ""
    ).toLowerCase();
    if (!thirdwebWallet) {
      return res
        .status(401)
        .json({ ok: false, error: "Thirdweb token missing wallet", requestId: req.requestId });
    }

    if (thirdwebWallet !== walletLower) {
      return res
        .status(401)
        .json({ ok: false, error: "Wallet does not match token", requestId: req.requestId });
    }

    const profile = Array.isArray(me.profiles) && me.profiles.length ? me.profiles[0] : null;

    const update = {
      wallet_address: walletLower,
      email: profile?.email || null,
      provider: profile?.type || null,
      provider_user_id: profile?.id || null,
      display_name: profile?.name || null,
      avatar_url: profile?.picture || null,
      last_login_at: new Date()
    };

    const user = await User.findOneAndUpdate(
      { wallet_address: walletLower },
      {
        $set: update,
        $setOnInsert: { active: true, role: "PUBLIC" }
      },
      { new: true, upsert: true }
    );

    if (user.active === false) {
      return res
        .status(403)
        .json({ ok: false, error: "Account disabled", requestId: req.requestId });
    }

    const jwtToken = jwt.sign(
      { userId: user._id.toString(), wallet_address: user.wallet_address },
      requireJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({ ok: true, token: jwtToken, user });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  res.json({ ok: true, user: req.user });
};

exports.logout = async (_req, res) => {
  // Stateless logout; client discards token.
  res.json({ ok: true });
};

// Dev-only login. Gated by NODE_ENV !== 'production' AND ALLOW_DEV_LOGIN === 'true'.
// Accepts { email } or { walletAddress } and issues a JWT for the matching user.
// Lets us run the whole stack offline without going through Thirdweb.
exports.devLogin = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_LOGIN !== "true") {
      return res.status(404).json({ ok: false, error: "Not found", requestId: req.requestId });
    }

    const { email, walletAddress } = req.body || {};
    if (!email && !walletAddress) {
      return res
        .status(400)
        .json({ ok: false, error: "email or walletAddress required", requestId: req.requestId });
    }

    const query = email
      ? { email: String(email).toLowerCase() }
      : { wallet_address: String(walletAddress).toLowerCase() };

    const user = await User.findOne(query);
    if (!user) {
      return res
        .status(404)
        .json({ ok: false, error: "User not found", requestId: req.requestId });
    }
    if (user.active === false) {
      return res
        .status(403)
        .json({ ok: false, error: "Account disabled", requestId: req.requestId });
    }

    user.last_login_at = new Date();
    await user.save();

    const jwtToken = jwt.sign(
      { userId: user._id.toString(), wallet_address: user.wallet_address },
      requireJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({ ok: true, token: jwtToken, user });
  } catch (err) {
    next(err);
  }
};

// Public list of dev users (only when dev-login is enabled) so the UI can show a picker.
exports.devUsers = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_LOGIN !== "true") {
      return res.status(404).json({ ok: false, error: "Not found", requestId: req.requestId });
    }
    const users = await User.find({ active: true })
      .select("email role display_name wallet_address")
      .sort({ role: 1, email: 1 });
    return res.json({ ok: true, users });
  } catch (err) {
    next(err);
  }
};
