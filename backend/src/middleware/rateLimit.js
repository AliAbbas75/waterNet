const buckets = new Map();

function now() {
  return Date.now();
}

function getKey(req, keyPrefix) {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  return `${keyPrefix}:${ip}`;
}

function rateLimit({ windowMs, max, keyPrefix }) {
  return function rateLimitMiddleware(req, res, next) {
    const key = getKey(req, keyPrefix);
    const entry = buckets.get(key);
    const timestamp = now();

    if (!entry || timestamp > entry.resetAt) {
      buckets.set(key, { count: 1, resetAt: timestamp + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - timestamp) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ ok: false, error: "Too many requests", requestId: req.requestId });
    }

    return next();
  };
}

module.exports = { rateLimit };
