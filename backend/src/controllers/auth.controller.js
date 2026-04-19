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

    if (!token) return res.status(400).json({ error: "token is required" });
    if (!walletAddress) return res.status(400).json({ error: "walletAddress is required" });

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
    if (!thirdwebWallet) return res.status(401).json({ error: "Thirdweb token missing wallet" });

    if (thirdwebWallet !== walletLower) {
      return res.status(401).json({ error: "Wallet does not match token" });
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
        $setOnInsert: { active: true }
      },
      { new: true, upsert: true }
    );

    if (user.active === false) {
      return res.status(403).json({ error: "Account disabled" });
    }

    const jwtToken = jwt.sign(
      { userId: user._id.toString(), wallet_address: user.wallet_address },
      requireJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({ token: jwtToken, user });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  res.json({ user: req.user });
};

exports.logout = async (_req, res) => {
  // Stateless logout; client discards token.
  res.json({ ok: true });
};
