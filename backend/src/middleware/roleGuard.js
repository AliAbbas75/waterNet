const protect = require('./protect');

function requireRole(requiredRole) {
  return (req, res, next) => {
    // First, ensure user is authenticated
    protect(req, res, (err) => {
      if (err || !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userRole = req.user.role;
      const roleHierarchy = {
        'PUBLIC': 0,
        'MAINTAINER': 1,
        'ADMIN': 2,
        'SUPER_ADMIN': 3
      };

      if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    });
  };
}

module.exports = { requireRole };