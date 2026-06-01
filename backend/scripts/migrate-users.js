/* eslint-disable no-console */
// Idempotent migration: ensures every DB user has a custodial wallet record
// and is registered on the UserRegistry contract.
// Safe to run multiple times; skips users that are already complete.
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
  isActiveOnChain
} = require("../src/config/blockchain");

async function migrateUsers() {
  const users = await User.find({}).lean();
  console.log(`Found ${users.length} user(s) to check.\n`);

  let walletsCreated = 0;
  let onChainRegistered = 0;
  let alreadyComplete = 0;
  let errors = 0;

  for (const user of users) {
    try {
      // 1. Ensure a custodial wallet record exists.
      let walletRecord = await Wallet.findOne({ userId: user._id, active: true });

      if (!walletRecord) {
        const wallet = ethers.Wallet.createRandom();
        await User.findByIdAndUpdate(user._id, { wallet_address: wallet.address.toLowerCase() });
        walletRecord = await createWalletForUser(user._id, { wallet });
        walletsCreated++;
        console.log(`[${user.email}] Created wallet: ${wallet.address}`);
      }

      // 2. Ensure registered on-chain.
      if (isBlockchainEnabled()) {
        let registeredOnChain = false;
        try {
          registeredOnChain = await isActiveOnChain(walletRecord.address);
        } catch {
          // Treat chain read failure as "not registered".
        }

        if (!registeredOnChain) {
          try {
            await registerUserOnChain(walletRecord.address, user.role);
            onChainRegistered++;
            console.log(`[${user.email}] Registered on-chain: ${walletRecord.address} (${user.role})`);
          } catch (regErr) {
            // Contract may revert if already registered with a non-active status.
            console.warn(`[${user.email}] On-chain register skipped: ${regErr.message}`);
            alreadyComplete++;
          }
        } else {
          alreadyComplete++;
        }
      } else {
        alreadyComplete++;
      }
    } catch (err) {
      errors++;
      console.error(`[${user.email}] Error: ${err.message}`);
    }
  }

  console.log("\nMigration summary:");
  console.log(`  Wallets created   : ${walletsCreated}`);
  console.log(`  On-chain registered: ${onChainRegistered}`);
  console.log(`  Already complete  : ${alreadyComplete}`);
  if (errors) console.log(`  Errors            : ${errors}`);
}

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("MONGODB_URI not set. Copy backend/.env.example to backend/.env first.");
      process.exit(1);
    }
    await connectDb();
    console.log("Migrating users to on-chain registry…\n");
    await migrateUsers();
    console.log("\nDone.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
})();
