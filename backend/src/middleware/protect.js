const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res
        .status(401)
        .json({ ok: false, error: "Missing bearer token", requestId: req.requestId });
    }

    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({ ok: false, error: "Server not configured", requestId: req.requestId });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    if (!userId) {
      return res.status(401).json({ ok: false, error: "Invalid token", requestId: req.requestId });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(401)
        .json({ ok: false, error: "User not found", requestId: req.requestId });
    }

    if (user.active === false) {
      return res
        .status(403)
        .json({ ok: false, error: "Account disabled", requestId: req.requestId });
    }

    req.user = user;
    next();
  } catch {
    return res
      .status(401)
      .json({ ok: false, error: "Invalid or expired token", requestId: req.requestId });
  }
};
