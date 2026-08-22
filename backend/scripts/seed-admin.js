/* eslint-disable no-console */
// Bootstrap a single SUPER_ADMIN user + custodial wallet + on-chain registration.
// Idempotent: safe to run multiple times.
//
// Required env:  MONGODB_URI, SEED_ADMIN_EMAIL
// Optional env:  SEED_ADMIN_NAME (default "Super Admin")
//                AUTH_BLOCKCHAIN_ENABLED, CHAIN_* vars (for on-chain registration)
require("dotenv").config();

const mongoose = require("mongoose");
const { ethers } = require("ethers");

const { connectDb } = require("../src/config/db");
const User = require("../src/models/User");
const Wallet = require("../src/models/Wallet");
const { createWalletForUser } = require("../src/services/wallet.service");
const {
  registerUserOnChain,
  isBlockchainEnabled,
  getRoleFromChain
} = require("../src/config/blockchain");

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || "").toLowerCase();
  if (!email) {
    console.error("SEED_ADMIN_EMAIL is required. Set it in .env before running this script.");
    process.exit(1);
  }
  const displayName = process.env.SEED_ADMIN_NAME || "Super Admin";

  let user = await User.findOne({ email });

  if (!user) {
    const wallet = ethers.Wallet.createRandom();
    user = await User.create({
      email,
      wallet_address: wallet.address.toLowerCase(),
      role: "SUPER_ADMIN",
      display_name: displayName,
      provider: "blockchain",
      provider_user_id: email,
      active: true
    });
    await createWalletForUser(user._id, { wallet });
    console.log(`Created admin user: ${email}`);
    console.log(`  Wallet: ${wallet.address}`);

    if (isBlockchainEnabled()) {
      await registerUserOnChain(wallet.address, "SUPER_ADMIN");
      console.log("  Registered on-chain.");
    }
    return;
  }

  console.log(`Admin user already exists: ${email} (${user.wallet_address})`);

  // Ensure custodial wallet record exists.
  let walletRecord = await Wallet.findOne({ userId: user._id, active: true });
  if (!walletRecord) {
    const wallet = ethers.Wallet.createRandom();
    await User.findByIdAndUpdate(user._id, { wallet_address: wallet.address.toLowerCase() });
    walletRecord = await createWalletForUser(user._id, { wallet });
    console.log(`  Created missing wallet: ${wallet.address}`);
  } else {
    console.log(`  Wallet: ${walletRecord.address}`);
  }

  // Ensure on-chain registration.
  if (isBlockchainEnabled()) {
    try {
      const chainRole = await getRoleFromChain(walletRecord.address);
      if (chainRole === "PUBLIC") {
        await registerUserOnChain(walletRecord.address, user.role);
        console.log("  Registered on-chain.");
      } else {
        console.log(`  Already on-chain (role=${chainRole}).`);
      }
    } catch (err) {
      console.warn(`  Chain check failed: ${err.message}`);
    }
  }
}

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("MONGODB_URI not set. Copy backend/.env.example to backend/.env first.");
      process.exit(1);
    }
    await connectDb();
    console.log("Seeding admin user…");
    await seedAdmin();
    console.log("Done.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("seed-admin failed:", err);
    process.exit(1);
  }
})();
