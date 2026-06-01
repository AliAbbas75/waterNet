const crypto = require("crypto");
const { ethers } = require("ethers");
const { Resend } = require("resend");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const Invite = require("../models/Invite");
const { logAudit } = require("../services/audit.service");
const { createWalletForUser } = require("../services/wallet.service");
const { hashToken } = require("../services/crypto.service");
const { registerUserOnChain, ROLE_TO_ID, isBlockchainEnabled } = require("../config/blockchain");

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

function generateInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

async function deliverInviteEmail({ email, role, link, expiresAt }) {
  if (!email || !link) return false;

  const expText = expiresAt ? new Date(expiresAt).toLocaleString() : "48 hours";
  const subject = "Your WaterNet role invite";
  const html =
    `<p>You have been invited to join WaterNet as <strong>${role}</strong>.</p>` +
    `<p><a href="${link}">Accept your invite</a></p>` +
    `<p>This invite expires ${expText}.</p>`;

  // Priority 1 — SMTP
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;
  if (smtpUser && smtpPass && smtpFrom) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });
    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject,
      html
    });
    return true;
  }

  // Priority 2 — Resend
  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;
  if (resendKey && resendFrom) {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: resendFrom,
      to: email,
      subject,
      html
    });
    return true;
  }

  // Fallback — log for dev
  console.log(`Invite link for ${email}: ${link}`);
  return false;
}

exports.registerUser = async (req, res, next) => {
  try {
    ensureBlockchainAuthEnabled();
    const email = normalizeEmail(req.body?.email);
    const role = String(req.body?.role || "PUBLIC").toUpperCase();
    const displayName = req.body?.displayName ? String(req.body.displayName) : null;

    if (!email) {
      return res.status(400).json({ ok: false, error: "email is required", requestId: req.requestId });
    }

    if (ROLE_TO_ID[role] === undefined) {
      return res.status(400).json({ ok: false, error: "Invalid role", requestId: req.requestId });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ ok: false, error: "User already exists", requestId: req.requestId });
    }

    const generatedWallet = ethers.Wallet.createRandom();

    const user = await User.create({
      wallet_address: generatedWallet.address,
      role,
      email,
      display_name: displayName,
      active: true
    });

    const wallet = await createWalletForUser(user._id, { wallet: generatedWallet });

    await registerUserOnChain(wallet.address, role);

    await logAudit({
      event: "admin.user.register",
      req,
      actorUserId: req.user?._id || null,
      targetUserId: user._id,
      meta: { role, email, wallet: wallet.address.toLowerCase() }
    });

    return res.status(201).json({ ok: true, user, walletAddress: wallet.address });
  } catch (err) {
    next(err);
  }
};

exports.createInvite = async (req, res, next) => {
  try {
    ensureBlockchainAuthEnabled();
    const email = normalizeEmail(req.body?.email);
    const role = String(req.body?.role || "").toUpperCase();

    if (!email) {
      return res.status(400).json({ ok: false, error: "email is required", requestId: req.requestId });
    }

    if (!ROLE_TO_ID[role] || role === "PUBLIC" || role === "SUPER_ADMIN") {
      return res.status(400).json({ ok: false, error: "Invalid role", requestId: req.requestId });
    }

    if (req.user?.role === "ADMIN" && role !== "MAINTAINER") {
      return res.status(403).json({ ok: false, error: "ADMIN can only invite MAINTAINER", requestId: req.requestId });
    }

    if (req.user?.role === "SUPER_ADMIN" && !["MAINTAINER", "ADMIN"].includes(role)) {
      return res.status(400).json({ ok: false, error: "Invalid role", requestId: req.requestId });
    }

    const existing = await Invite.findOne({
      email,
      usedAt: null,
      expiresAt: { $gt: new Date() }
    });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Invite already pending", requestId: req.requestId });
    }

    const token = generateInviteToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const invite = await Invite.create({
      email,
      role,
      tokenHash,
      createdByUserId: req.user._id,
      expiresAt
    });

    const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || req.headers.origin || "";
    const link = baseUrl
      ? `${String(baseUrl).replace(/\/$/, "")}/invite/${token}`
      : null;

    await logAudit({
      event: "admin.invite.create",
      req,
      actorUserId: req.user?._id || null,
      meta: { role, email, inviteId: invite._id.toString() }
    });

    let emailSent = false;
    try {
      emailSent = await deliverInviteEmail({ email, role, link, expiresAt });
    } catch (err) {
      console.warn("Invite email failed:", err.message || err);
    }

    return res.status(201).json({
      ok: true,
      inviteId: invite._id,
      expiresAt,
      token,
      link,
      emailSent
    });
  } catch (err) {
    next(err);
  }
};
