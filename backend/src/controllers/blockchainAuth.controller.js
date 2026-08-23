const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const { sendMail } = require("../services/mailer.service");

const User = require("../models/User");
const Invite = require("../models/Invite");
const OtpToken = require("../models/OtpToken");
const PreAuthSession = require("../models/PreAuthSession");
const AuthChallenge = require("../models/AuthChallenge");
const { hashToken } = require("../services/crypto.service");
const { logAudit } = require("../services/audit.service");
const { loadWalletSigner, createWalletForUser } = require("../services/wallet.service");
const {
  getRoleFromChain,
  isActiveOnChain,
  isBlockchainEnabled,
  registerUserOnChain,
  setRoleOnChain,
  ROLE_TO_ID
} = require("../config/blockchain");

const OTP_EXP_MINUTES = 10;
const PRE_AUTH_EXP_MINUTES = 10;
const CHALLENGE_EXP_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

function requireJwtSecret() {
  if (!process.env.JWT_SECRET) {
    const err = new Error("Missing JWT_SECRET");
    err.statusCode = 500;
    throw err;
  }
  return process.env.JWT_SECRET;
}

function ensureBlockchainAuthEnabled() {
  if (!isBlockchainEnabled()) {
    const err = new Error("Blockchain auth is disabled");
    err.statusCode = 404;
    throw err;
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeAddress(address) {
  return String(address || "").trim().toLowerCase();
}

function randomOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

const EMAIL_HTML = (code, exp) =>
  `<p>Your WaterNet one-time login code is <strong style="font-size:1.5em">${code}</strong>.</p>` +
  `<p>It expires in ${exp} minutes. Do not share it.</p>`;

/**
 * Puts a login code in the logs.
 *
 * This hands anyone who can read the logs the ability to sign in as anyone who
 * requests a code, so it is off unless asked for and says so every time rather
 * than printing a bare number somebody might not recognise as a credential.
 * It is a way to run without a verified sending domain, not a way to run.
 */
const LOG_OTP_TO_CONSOLE = process.env.OTP_LOG_TO_CONSOLE === "true";

function logOtp(email, code, why) {
  // Printed as a banner rather than a line. A hosted log is a fast-moving wall
  // of request lines and socket churn, and a code that has to be searched for
  // is not really in the log — the whole point of putting it here is to read it
  // off the screen while signing in on a phone.
  const rule = "=".repeat(58);
  console.log("");
  console.log(rule);
  console.log(`  LOGIN CODE      ${code.split("").join(" ")}`);
  console.log(`  for             ${email}`);
  console.log(`  expires in      ${OTP_EXP_MINUTES} minutes`);
  console.log(`  why it is here  ${why}`);
  console.log(`  ${email} can be signed in as by anyone reading this.`);
  console.log(rule);
  console.log("");
}

/**
 * Gets the login code to the user, by whatever route is working.
 *
 * Transport choice and the fallback between them belong to the mailer; what is
 * decided here is what happens when every one of them fails. Delivery failing
 * must not abort the request — an unreachable mail server should degrade how
 * the code arrives, not make the system impossible to sign in to — so the
 * console is the last resort, and loud about being one.
 */
async function deliverOtp(email, code) {
  try {
    const { transport } = await sendMail({
      to: email,
      subject: "Your WaterNet login code",
      html: EMAIL_HTML(code, OTP_EXP_MINUTES)
    });
    // Asked for explicitly, so it is printed even when the mail went out. The
    // alternative — relying on delivery failing — makes the log line an
    // accident of a broken sender, which quietly stops the day it is fixed.
    if (LOG_OTP_TO_CONSOLE) logOtp(email, code, `sent via ${transport}`);
    return { delivered: true, transport };
  } catch (err) {
    // Every configured transport was tried and refused. The code still has to
    // reach somebody, so it goes to the logs regardless of the setting: the
    // alternative is an account nobody can get into.
    console.error(`OTP delivery failed for ${email}: ${err.message}`);
    logOtp(email, code, "nothing delivered it");
    return { delivered: false, transport: null };
  }
}

exports.sendOtp = async (req, res, next) => {
  try {
    ensureBlockchainAuthEnabled();
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ ok: false, error: "email is required", requestId: req.requestId });
    }

    const user = await User.findOne({ email, active: true });
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found", requestId: req.requestId });
    }

    const code = randomOtp();
    const codeHash = hashToken(code);
    const expiresAt = new Date(Date.now() + OTP_EXP_MINUTES * 60 * 1000);

    await OtpToken.create({ userId: user._id, email, codeHash, expiresAt });
    await deliverOtp(email, code);
    await logAudit({
      event: "auth.otp.sent",
      req,
      actorUserId: user._id,
      meta: { email }
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    ensureBlockchainAuthEnabled();
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();
    if (!email || !code) {
      return res.status(400).json({ ok: false, error: "email and code are required", requestId: req.requestId });
    }

    const user = await User.findOne({ email, active: true });
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found", requestId: req.requestId });
    }

    const otp = await OtpToken.findOne({ userId: user._id, consumedAt: null }).sort({ createdAt: -1 });
    if (!otp || otp.expiresAt < new Date()) {
      return res.status(400).json({ ok: false, error: "OTP expired", requestId: req.requestId });
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      otp.consumedAt = new Date();
      await otp.save();
      return res.status(429).json({ ok: false, error: "Too many attempts", requestId: req.requestId });
    }

    const isMatch = hashToken(code) === otp.codeHash;
    if (!isMatch) {
      otp.attempts += 1;
      await otp.save();
      return res.status(400).json({ ok: false, error: "Invalid code", requestId: req.requestId });
    }

    otp.consumedAt = new Date();
    await otp.save();

    const preAuthToken = generateToken();
    const expiresAt = new Date(Date.now() + PRE_AUTH_EXP_MINUTES * 60 * 1000);
    await PreAuthSession.create({
      userId: user._id,
      tokenHash: hashToken(preAuthToken),
      expiresAt
    });
    await logAudit({
      event: "auth.otp.verified",
      req,
      actorUserId: user._id,
      meta: { email }
    });

    return res.json({ ok: true, preAuthToken, expiresAt });
  } catch (err) {
    next(err);
  }
};

exports.challenge = async (req, res, next) => {
  try {
    ensureBlockchainAuthEnabled();
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ ok: false, error: "Missing pre-auth token", requestId: req.requestId });
    }

    const session = await PreAuthSession.findOne({
      tokenHash: hashToken(token),
      consumedAt: null
    });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ ok: false, error: "Pre-auth expired", requestId: req.requestId });
    }

    session.consumedAt = new Date();
    await session.save();

    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + CHALLENGE_EXP_MINUTES * 60 * 1000);

    const challenge = await AuthChallenge.create({
      userId: session.userId,
      nonce,
      expiresAt
    });
    await logAudit({
      event: "auth.challenge.issued",
      req,
      actorUserId: session.userId,
      meta: { challengeId: challenge._id.toString() }
    });

    return res.json({ ok: true, challengeId: challenge._id, nonce, expiresAt });
  } catch (err) {
    next(err);
  }
};

exports.register = async (req, res, next) => {
  try {
    ensureBlockchainAuthEnabled();
    const email = normalizeEmail(req.body?.email);
    const displayName = req.body?.displayName ? String(req.body.displayName).trim() : null;

    if (!email) {
      return res.status(400).json({ ok: false, error: "email is required", requestId: req.requestId });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Email already registered", requestId: req.requestId });
    }

    const generatedWallet = ethers.Wallet.createRandom();

    const user = await User.create({
      wallet_address: generatedWallet.address,
      role: "PUBLIC",
      email,
      display_name: displayName,
      active: true
    });

    const wallet = await createWalletForUser(user._id, { wallet: generatedWallet });
    await registerUserOnChain(wallet.address, "PUBLIC");

    const code = randomOtp();
    const codeHash = hashToken(code);
    const expiresAt = new Date(Date.now() + OTP_EXP_MINUTES * 60 * 1000);
    await OtpToken.create({ userId: user._id, email, codeHash, expiresAt });
    await deliverOtp(email, code);

    await logAudit({
      event: "auth.register",
      req,
      actorUserId: user._id,
      meta: { email, wallet: wallet.address.toLowerCase() }
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.verifyChallenge = async (req, res, next) => {
  try {
    ensureBlockchainAuthEnabled();
    const challengeId = req.body?.challengeId;
    if (!challengeId) {
      return res.status(400).json({ ok: false, error: "challengeId is required", requestId: req.requestId });
    }

    const challenge = await AuthChallenge.findById(challengeId);
    if (!challenge || challenge.usedAt || challenge.expiresAt < new Date()) {
      return res.status(400).json({ ok: false, error: "Challenge expired", requestId: req.requestId });
    }

    challenge.usedAt = new Date();
    await challenge.save();

    const user = await User.findById(challenge.userId);
    if (!user || user.active === false) {
      return res.status(403).json({ ok: false, error: "Account disabled", requestId: req.requestId });
    }

    const { wallet } = await loadWalletSigner(user._id);
    const message = `WaterNet login challenge: ${challenge.nonce}`;
    const signature = await wallet.signMessage(message);
    const recovered = ethers.verifyMessage(message, signature);

    if (recovered.toLowerCase() !== wallet.address.toLowerCase()) {
      return res.status(401).json({ ok: false, error: "Signature verification failed", requestId: req.requestId });
    }

    const chainRole = await getRoleFromChain(wallet.address);
    const chainActive = await isActiveOnChain(wallet.address);
    if (!chainActive) {
      return res.status(403).json({ ok: false, error: "Account disabled", requestId: req.requestId });
    }

    // The registry stores four roles; this app has five. MANAGER is written
    // on-chain as the maintainer grade, so reading it straight back would demote
    // every manager to MAINTAINER on login — and persist it.
    //
    // The chain is still authoritative about privilege. It just cannot express
    // the distinction, so when the stored role encodes to the same id the chain
    // reports, the two agree and the more specific local role stands. Only a
    // genuine disagreement overwrites.
    const agrees = ROLE_TO_ID[user.role] === ROLE_TO_ID[chainRole];
    if (!agrees) {
      user.role = chainRole;
    }
    user.active = chainActive;
    user.last_login_at = new Date();
    await user.save();

    await logAudit({
      event: "auth.login.success",
      req,
      actorUserId: user._id,
      meta: { role: user.role, wallet: wallet.address.toLowerCase() }
    });

    const jwtToken = jwt.sign({ userId: user._id.toString() }, requireJwtSecret(), {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    });

    return res.json({ ok: true, token: jwtToken, user });
  } catch (err) {
    next(err);
  }
};

exports.validateInvite = async (req, res, next) => {
  try {
    ensureBlockchainAuthEnabled();
    const token = String(req.params?.token || "").trim();
    if (!token) {
      return res.status(400).json({ ok: false, error: "token is required", requestId: req.requestId });
    }
    const tokenHash = hashToken(token);
    const invite = await Invite.findOne({ tokenHash });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return res.status(404).json({ ok: false, error: "Invite not found", requestId: req.requestId });
    }
    return res.json({
      ok: true,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt
    });
  } catch (err) {
    next(err);
  }
};

exports.acceptInvite = async (req, res, next) => {
  try {
    ensureBlockchainAuthEnabled();
    const token = String(req.body?.token || "").trim();
    if (!token) {
      return res.status(400).json({ ok: false, error: "token is required", requestId: req.requestId });
    }
    if (!req.user || !req.user.email) {
      return res.status(400).json({ ok: false, error: "User email required", requestId: req.requestId });
    }

    const tokenHash = hashToken(token);
    const invite = await Invite.findOne({ tokenHash });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return res.status(404).json({ ok: false, error: "Invite not found", requestId: req.requestId });
    }

    const inviteEmail = normalizeEmail(invite.email);
    const userEmail = normalizeEmail(req.user.email);
    if (inviteEmail !== userEmail) {
      return res.status(403).json({ ok: false, error: "Invite email mismatch", requestId: req.requestId });
    }

    // Must match the roles createInvite is allowed to issue, or a legitimately
    // issued invite becomes unredeemable at the last step.
    const targetRole = String(invite.role || "").toUpperCase();
    if (!targetRole || !["MAINTAINER", "MANAGER", "ADMIN"].includes(targetRole)) {
      return res.status(400).json({ ok: false, error: "Invalid invite role", requestId: req.requestId });
    }

    const walletAddress = normalizeAddress(req.user.wallet_address);
    if (!walletAddress) {
      return res.status(400).json({ ok: false, error: "Missing wallet address", requestId: req.requestId });
    }

    const chainReceipt = await setRoleOnChain(walletAddress, targetRole);

    req.user.role = targetRole;
    await req.user.save();

    invite.usedAt = new Date();
    invite.usedByUserId = req.user._id;
    await invite.save();

    await logAudit({
      event: "admin.invite.accept",
      req,
      actorUserId: req.user._id,
      meta: { role: targetRole, wallet: walletAddress, inviteId: invite._id.toString() }
    });

    return res.json({
      ok: true,
      role: targetRole,
      wallet_address: walletAddress,
      txHash: chainReceipt?.txHash || null,
      blockNumber: chainReceipt?.blockNumber || null
    });
  } catch (err) {
    next(err);
  }
};
