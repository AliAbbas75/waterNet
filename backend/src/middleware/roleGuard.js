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
      const roleHierarchy = {
        PUBLIC: 0,
        MAINTAINER: 1,
        ADMIN: 2,
        SUPER_ADMIN: 3
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