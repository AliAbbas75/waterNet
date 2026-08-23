const protect = require("./protect");

function requireRole(...requiredRoles) {
  const roles = requiredRoles.flat().filter(Boolean);

  return (req, res, next) => {
    // First, ensure user is authenticated
    protect(req, res, () => {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!roles.length) {
        return res.status(500).json({ error: "Server misconfigured (no roles)" });
      }

      const userRole = req.user.role;
      // App-side privilege ladder. These numbers are NOT the on-chain role ids
      // in config/blockchain.js — the deployed registry only knows four values
      // and cannot be renumbered, so the two are deliberately kept apart.
      const roleHierarchy = {
        PUBLIC: 0,
        MAINTAINER: 1,
        MANAGER: 2,
        ADMIN: 3,
        SUPER_ADMIN: 4
      };

      const userLevel = roleHierarchy[userRole] ?? -1;
      const allowed = roles.some((role) => userLevel >= (roleHierarchy[role] ?? 99));

      if (!allowed) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      next();
    });
  };
}

module.exports = { requireRole };