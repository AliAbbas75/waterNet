const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");

const AuthChallenge = require("../../shared/models/AuthChallenge");
const User = require("../../shared/models/User");

function normalizeWallet(wallet) {
  if (!wallet || typeof wallet !== "string") return null;
  try {
    return ethers.getAddress(wallet);
  } catch {
    return null;
  }
}

function getContract() {
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!rpcUrl) throw Object.assign(new Error("Missing RPC_URL"), { statusCode: 500 });
  if (!contractAddress)
    throw Object.assign(new Error("Missing CONTRACT_ADDRESS"), { statusCode: 500 });

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Minimal ABI: adjust via env if your function names differ.
  const isRegisteredFn = process.env.CONTRACT_IS_REGISTERED_FN || "isRegistered";
  const roleFn = process.env.CONTRACT_ROLE_FN || "roleOf";

  const abi = [
    `function ${isRegisteredFn}(address user) view returns (bool)`,
    `function ${roleFn}(address user) view returns (uint8)`
  ];

  return { contract: new ethers.Contract(contractAddress, abi, provider), isRegisteredFn, roleFn };
}

function mapRoleFromChain(roleValue) {
  // Default mapping: 0=Viewer/Public, 1=Maintainer, 2=Administrator
  const roleNumber = Number(roleValue);
  if (Number.isNaN(roleNumber)) return null;
  if (roleNumber === 2) return "admin";
  if (roleNumber === 1) return "maintainer";
  if (roleNumber === 0) return "public";
  return null;
}

function requireJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw Object.assign(new Error("Missing JWT_SECRET"), { statusCode: 500 });
  }
  return process.env.JWT_SECRET;
}

function buildChallengeMessage({ wallet, challengeId, issuedAtIso, chainId }) {
  // Keep this stable; changing it will invalidate signature verification.
  return [
    "WaterNet Login",
    "",
    `Wallet: ${wallet}`,
    `Challenge ID: ${challengeId}`,
    `Chain ID: ${chainId}`,
    `Issued At: ${issuedAtIso}`,
    "",
    "Sign this message to prove you own this wallet.",
    "This does not cost gas and does not expose any password."
  ].join("\n");
}

exports.createChallenge = async ({ wallet }) => {
  const normalizedWallet = normalizeWallet(wallet);
  if (!normalizedWallet) {
    throw Object.assign(new Error("Invalid wallet address"), { statusCode: 400 });
  }

  const chainId = Number(process.env.CHAIN_ID || 84532);
  const issuedAtIso = new Date().toISOString();

  // Create first to get a stable challengeId
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
  const challenge = await AuthChallenge.create({
    wallet: normalizedWallet,
    message: "pending",
    expiresAt
  });

  const message = buildChallengeMessage({
    wallet: normalizedWallet,
    challengeId: String(challenge._id),
    issuedAtIso,
    chainId
  });

  challenge.message = message;
  await challenge.save();

  return {
    wallet: normalizedWallet,
    challengeId: String(challenge._id),
    expiresAt: challenge.expiresAt.toISOString(),
    message
  };
};

exports.loginWithSignature = async ({ wallet, challengeId, signature }) => {
  const normalizedWallet = normalizeWallet(wallet);
  if (!normalizedWallet) {
    throw Object.assign(new Error("Invalid wallet address"), { statusCode: 400 });
  }
  if (!challengeId) {
    throw Object.assign(new Error("challengeId is required"), { statusCode: 400 });
  }
  if (!signature) {
    throw Object.assign(new Error("signature is required"), { statusCode: 400 });
  }

  const challenge = await AuthChallenge.findById(challengeId);
  if (!challenge) {
    throw Object.assign(new Error("Challenge not found"), { statusCode: 400 });
  }

  if (challenge.usedAt) {
    throw Object.assign(new Error("Challenge already used"), { statusCode: 400 });
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    throw Object.assign(new Error("Challenge expired"), { statusCode: 400 });
  }
  if (challenge.wallet !== normalizedWallet) {
    throw Object.assign(new Error("Wallet does not match challenge"), { statusCode: 400 });
  }

  let recovered;
  try {
    recovered = ethers.verifyMessage(challenge.message, signature);
  } catch {
    throw Object.assign(new Error("Invalid signature"), { statusCode: 400 });
  }

  if (ethers.getAddress(recovered) !== normalizedWallet) {
    throw Object.assign(new Error("Signature does not match wallet"), { statusCode: 401 });
  }

  // One-time use: mark as used before doing slower chain reads
  challenge.usedAt = new Date();
  await challenge.save();

  const { contract, isRegisteredFn, roleFn } = getContract();

  let isRegistered;
  try {
    isRegistered = await contract[isRegisteredFn](normalizedWallet);
  } catch (err) {
    throw Object.assign(new Error("Failed to read registration status from blockchain"), {
      statusCode: 500,
      cause: err
    });
  }

  if (!isRegistered) {
    throw Object.assign(new Error("Wallet is not registered by an administrator"), { statusCode: 403 });
  }

  let roleValue;
  try {
    roleValue = await contract[roleFn](normalizedWallet);
  } catch (err) {
    throw Object.assign(new Error("Failed to read role from blockchain"), { statusCode: 500, cause: err });
  }

  const role = mapRoleFromChain(roleValue);
  if (!role) {
    throw Object.assign(new Error("Unknown role returned from blockchain"), { statusCode: 500 });
  }

  // Optional: keep a local user record for app data (role is still sourced from chain)
  let user = await User.findOne({ wallet: normalizedWallet });
  if (!user) {
    user = await User.create({ wallet: normalizedWallet, role });
  } else if (user.role !== role) {
    user.role = role;
    await user.save();
  }

  const token = jwt.sign(
    { id: user._id, wallet: normalizedWallet, role },
    requireJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );

  return { token, role, wallet: normalizedWallet };
};

exports._internal = {
  normalizeWallet,
  mapRoleFromChain,
  buildChallengeMessage
};
