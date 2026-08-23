/* eslint-disable no-console */
/**
 * Brings the chain to a known-good state, from configuration alone.
 *
 * The problem this solves: `infra/besu-network/data/` is not in git — it holds
 * a live RocksDB and a private key, neither of which belongs in a repository.
 * So a fresh clone had a genesis but no chain, no deployed contract and no
 * registered users, and every on-chain role check failed.
 *
 * It does not need to be in git. A contract's address is
 * keccak(rlp([deployer, nonce])), so a chain built from the same genesis with
 * the same admin key puts UserRegistry at the same address every time, on any
 * machine. The chain state is reproducible output; the genesis and two keys are
 * the input.
 *
 * Idempotent by design — safe to run on every boot:
 *   1. wait for the RPC to answer
 *   2. if the expected address already has code, there is nothing to deploy
 *   3. otherwise deploy, and verify it landed where it was predicted to
 *   4. reconcile every active user's role onto the chain
 *
 *   node scripts/ensure-chain.js
 *   node scripts/ensure-chain.js --skip-users      (deploy only)
 *   node scripts/ensure-chain.js --print-address   (compute and exit)
 */
require("dotenv").config();
const { ethers } = require("ethers");
const mongoose = require("mongoose");

const { connectDb } = require("../src/config/db");
const User = require("../src/models/User");
const { deployRegistry } = require("./deploy-user-registry");
const { ROLE_TO_ID } = require("../src/config/blockchain");

const SKIP_USERS = process.argv.includes("--skip-users");
const PRINT_ONLY = process.argv.includes("--print-address");

const REGISTRY_ABI = [
  "function register(address user, uint8 role)",
  "function setRole(address user, uint8 role)",
  "function setActive(address user, bool active)",
  "function roleOf(address user) view returns (uint8)",
  "function isActive(address user) view returns (bool)"
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

/**
 * Where UserRegistry will be, or already is.
 *
 * Nonce 0 because the admin account's first transaction on a fresh chain is
 * this deployment. That is what makes the address predictable rather than
 * something to be discovered and copied between machines.
 */
function expectedAddress(deployer) {
  return ethers.getCreateAddress({ from: deployer, nonce: 0 });
}

/** Besu takes a few seconds to open its RPC port; do not race it. */
async function waitForRpc(rpcUrl, { attempts = 30, delayMs = 2000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const net = await provider.getNetwork();
      const block = await provider.getBlockNumber();
      console.log(`  chain up — id ${net.chainId}, block ${block}`);
      return provider;
    } catch (err) {
      if (i === attempts) {
        throw new Error(
          `No RPC at ${rpcUrl} after ${attempts} attempts. ` +
            `Inside a container this is usually 127.0.0.1 leaking in from a host .env — ` +
            `it has to point at the node's address on the network the process is actually on.`
        );
      }
      if (i === 1) console.log(`  waiting for ${rpcUrl}…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/**
 * Puts every active user's role on the chain.
 *
 * `register` and `setRole` both write the role, but only register marks an
 * account active, so an address the registry has never seen goes through
 * register and a known one through setRole. Users with no wallet are skipped
 * rather than invented — a wallet is created when they first sign in.
 */
async function reconcileUsers(registry, provider) {
  const users = await User.find({ active: true, wallet_address: { $ne: null } })
    .select("display_name email role wallet_address")
    .lean();

  let registered = 0;
  let updated = 0;
  let alreadyCorrect = 0;
  let failed = 0;

  for (const user of users) {
    const address = ethers.getAddress(user.wallet_address);
    const wanted = ROLE_TO_ID[user.role] ?? ROLE_TO_ID.PUBLIC;

    try {
      const current = Number(await registry.roleOf(address));
      const active = await registry.isActive(address);

      if (active && current === wanted) {
        alreadyCorrect += 1;
        continue;
      }

      const tx = active
        ? await registry.setRole(address, wanted)
        : await registry.register(address, wanted);
      await tx.wait();

      if (active) updated += 1;
      else registered += 1;
    } catch (err) {
      failed += 1;
      console.warn(`  ! ${user.display_name || user.email}: ${err.shortMessage || err.message}`);
    }
  }

  console.log(
    `  users: ${registered} registered, ${updated} corrected, ${alreadyCorrect} already right` +
      (failed ? `, ${failed} failed` : "")
  );
  return { registered, updated, alreadyCorrect, failed };
}

async function main() {
  const rpcUrl = requireEnv("CHAIN_RPC_URL");
  const adminKey = requireEnv("CHAIN_ADMIN_PRIVATE_KEY");
  const deployer = new ethers.Wallet(adminKey).address;
  const predicted = expectedAddress(deployer);

  if (PRINT_ONLY) {
    console.log(predicted);
    return;
  }

  console.log("ensure-chain");
  console.log(`  deployer  ${deployer}`);
  console.log(`  registry  ${predicted}  (derived, not configured)`);

  const configured = process.env.CHAIN_USER_REGISTRY_ADDRESS;
  if (configured && configured.toLowerCase() !== predicted.toLowerCase()) {
    console.warn(
      `  ! CHAIN_USER_REGISTRY_ADDRESS is ${configured}, which is not where this ` +
        `admin key deploys. Either the key changed or the address was pinned by hand.`
    );
  }

  const provider = await waitForRpc(rpcUrl);

  const code = await provider.getCode(predicted);
  if (code && code !== "0x") {
    console.log("  registry already deployed — nothing to do");
  } else {
    console.log("  no contract at that address; deploying");
    const address = await deployRegistry({
      rpcUrl,
      privateKey: adminKey,
      superAdmin: process.env.CHAIN_SUPER_ADMIN || ethers.ZeroAddress
    });

    if (address.toLowerCase() !== predicted.toLowerCase()) {
      // A mismatch means the deployer had already sent a transaction, so this
      // was not nonce 0. Worth failing loudly: the whole point is that the
      // address is knowable without reading it back.
      throw new Error(
        `Deployed to ${address} but predicted ${predicted}. The admin account was ` +
          `not at nonce 0 — this chain is not fresh, or another process used the key.`
      );
    }
    console.log(`  deployed at ${address}`);
  }

  if (SKIP_USERS) {
    console.log("  skipping user reconciliation (--skip-users)");
  } else {
    await connectDb();
    const signer = new ethers.Wallet(adminKey, provider);
    const registry = new ethers.Contract(predicted, REGISTRY_ABI, signer);
    await reconcileUsers(registry, provider);
    await mongoose.disconnect();
  }

  console.log("ensure-chain: done");
  console.log(`\nCHAIN_USER_REGISTRY_ADDRESS=${predicted}`);
}

main().catch(async (err) => {
  console.error("ensure-chain failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* not connected */
  }
  process.exit(1);
});
