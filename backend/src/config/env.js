function assertEnv() {
  const required = ["MONGODB_URI", "JWT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    const err = new Error(`Missing required env var(s): ${missing.join(", ")}`);
    err.statusCode = 500;
    throw err;
  }
}

module.exports = { assertEnv };
