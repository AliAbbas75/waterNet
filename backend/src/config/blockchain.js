const { ethers } = require("ethers");

const REGISTRY_ABI = [
  "function register(address user, uint8 role)",
  "function setRole(address user, uint8 role)",
  "function setActive(address user, bool active)",
  "function roleOf(address user) view returns (uint8)",
  "function isActive(address user) view returns (bool)"
];

// The deployed UserRegistry rejects any role id above 3 and its bytecode is
// immutable, so the chain records four grades and cannot learn a fifth without
// a redeploy and a full re-migration of every user.
const ROLE_MAP = {
  0: "PUBLIC",
  1: "MAINTAINER",
  2: "ADMIN",
  3: "SUPER_ADMIN"
};

// MANAGER is an app-side role. It records on-chain as the nearest grade that
// does NOT over-state its privilege — the registry's own `onlyAdmin` check is
// `role >= ROLE_ADMIN`, so mapping MANAGER to 2 would hand it the power to
// register users and change roles on the chain itself. Mapping down is safe;
// mapping up would be a privilege escalation written to an immutable ledger.
//
// This is only ever written, never read for authorization: `roleOf` is not
// consulted at login, and MongoDB stays the authority on what a role means.
const ROLE_TO_ID = {
  PUBLIC: 0,
  MAINTAINER: 1,
  MANAGER: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3
};

let providerCache = null;

function isBlockchainEnabled() {
  return String(process.env.AUTH_BLOCKCHAIN_ENABLED || "").toLowerCase() === "true";
}

function requireBlockchainEnv() {
  const missing = [];
  if (!process.env.CHAIN_RPC_URL) missing.push("CHAIN_RPC_URL");
  if (!process.env.CHAIN_USER_REGISTRY_ADDRESS) missing.push("CHAIN_USER_REGISTRY_ADDRESS");
  if (missing.length) {
    const err = new Error(`Missing required blockchain env var(s): ${missing.join(", ")}`);
    err.statusCode = 500;
    throw err;
  }
}

function getProvider() {
  if (!providerCache) {
    requireBlockchainEnv();
    providerCache = new ethers.JsonRpcProvider(process.env.CHAIN_RPC_URL);
  }
  return providerCache;
}

function getRegistryContract({ withSigner } = {}) {
  requireBlockchainEnv();
  const provider = getProvider();
  const registry = new ethers.Contract(
    process.env.CHAIN_USER_REGISTRY_ADDRESS,
    REGISTRY_ABI,
    provider
  );

  if (!withSigner) return registry;

  if (!process.env.CHAIN_ADMIN_PRIVATE_KEY) {
    const err = new Error("Missing CHAIN_ADMIN_PRIVATE_KEY");
    err.statusCode = 500;
    throw err;
  }

  const signer = new ethers.Wallet(process.env.CHAIN_ADMIN_PRIVATE_KEY, provider);
  return registry.connect(signer);
}

async function getRoleFromChain(address) {
  const registry = getRegistryContract();
  const roleId = await registry.roleOf(address);
  return ROLE_MAP[Number(roleId)] || "PUBLIC";
}

async function isActiveOnChain(address) {
  const registry = getRegistryContract();
  return Boolean(await registry.isActive(address));
}

async function registerUserOnChain(address, role) {
  const registry = getRegistryContract({ withSigner: true });
  const roleId = ROLE_TO_ID[String(role || "").toUpperCase()] ?? ROLE_TO_ID.PUBLIC;
  const tx = await registry.register(address, roleId);
  const receipt = await tx.wait();
  return { txHash: tx.hash, blockNumber: receipt?.blockNumber || null };
}

async function setRoleOnChain(address, role) {
  const registry = getRegistryContract({ withSigner: true });
  const roleId = ROLE_TO_ID[String(role || "").toUpperCase()] ?? ROLE_TO_ID.PUBLIC;
  const tx = await registry.setRole(address, roleId);
  const receipt = await tx.wait();
  return { txHash: tx.hash, blockNumber: receipt?.blockNumber || null };
}

async function setActiveOnChain(address, active) {
  const registry = getRegistryContract({ withSigner: true });
  const tx = await registry.setActive(address, Boolean(active));
  await tx.wait();
}

module.exports = {
  isBlockchainEnabled,
  getRoleFromChain,
  isActiveOnChain,
  registerUserOnChain,
  setRoleOnChain,
  setActiveOnChain,
  ROLE_TO_ID,
  ROLE_MAP
};
