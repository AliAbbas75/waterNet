const { ethers } = require("ethers");
const Wallet = require("../models/Wallet");
const { decryptText, encryptText } = require("./crypto.service");

async function createWalletForUser(userId, options = {}) {
  const existing = await Wallet.findOne({ userId, active: true });
  if (existing) return existing;

  const wallet = options.wallet || ethers.Wallet.createRandom();
  const encryptedPrivateKey = encryptText(wallet.privateKey);

  return Wallet.create({
    userId,
    address: wallet.address.toLowerCase(),
    encryptedPrivateKey,
    keyVersion: 1,
    active: true
  });
}

async function loadWalletSigner(userId) {
  const record = await Wallet.findOne({ userId, active: true });
  if (!record) {
    const err = new Error("Wallet not found");
    err.statusCode = 404;
    throw err;
  }
  const privateKey = decryptText(record.encryptedPrivateKey);
  const wallet = new ethers.Wallet(privateKey);
  return { wallet, record };
}

module.exports = { createWalletForUser, loadWalletSigner };
