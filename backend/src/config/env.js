function assertEnv() {
  const required = [
    "MONGODB_URI",
    "JWT_SECRET",
    "PORT",
    "CORS_ORIGINS"
  ];

  const blockchainEnabled = String(process.env.AUTH_BLOCKCHAIN_ENABLED || "").toLowerCase() === "true";
  if (blockchainEnabled) {
    required.push("AUTH_MASTER_KEY", "CHAIN_RPC_URL", "CHAIN_USER_REGISTRY_ADDRESS", "CHAIN_ADMIN_PRIVATE_KEY");
  }

  const missing = required.filter((v) => !process.env[v]);

  if (missing.length) {
    const err = new Error(`Missing required env var(s): ${missing.join(", ")}`);
    err.statusCode = 500;
    throw err;
  }
}

module.exports = { assertEnv };
