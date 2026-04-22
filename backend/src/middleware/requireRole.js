function requireRole(...allowedRoles) {
  const roles = allowedRoles.flat().filter(Boolean);

  return function requireRoleMiddleware(req, res, next) {
    const user = req.user;

    if (!user) {
      return res
        .status(401)
        .json({ ok: false, error: "Unauthorized", requestId: req.requestId });
    }

    if (!roles.length) {
      return res.status(500).json({
        ok: false,
        error: "Server misconfigured (no roles)",
        requestId: req.requestId
      });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ ok: false, error: "Forbidden", requestId: req.requestId });
    }

    return next();
  };
}

module.exports = { requireRole };
