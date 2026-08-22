const express = require("express");
const authController = require("../controllers/auth.controller");
const blockchainAuth = require("../controllers/blockchainAuth.controller");
const protect = require("../middleware/protect");
const { rateLimit } = require("../middleware/rateLimit");
const { z, validateBody } = require("../middleware/validate");

const router = express.Router();

const registerSchema = z.object({
  email: z.string().min(1),
  displayName: z.string().min(1).optional()
});

const otpSchema = z.object({
  email: z.string().min(1)
});

const verifyOtpSchema = z.object({
  email: z.string().min(1),
  code: z.string().min(1)
});

const challengeVerifySchema = z.object({
  challengeId: z.string().min(1)
});

const acceptInviteSchema = z.object({
  token: z.string().min(1)
});

router.post(
  "/register",
  rateLimit({ windowMs: 10 * 60 * 1000, max: 3, keyPrefix: "auth-register" }),
  validateBody(registerSchema),
  blockchainAuth.register
);

router.get("/me", protect, authController.me);
router.post("/logout", protect, authController.logout);

router.post(
  "/send-otp",
  rateLimit({ windowMs: 10 * 60 * 1000, max: 5, keyPrefix: "otp-send" }),
  validateBody(otpSchema),
  blockchainAuth.sendOtp
);
router.post(
  "/verify-otp",
  rateLimit({ windowMs: 10 * 60 * 1000, max: 8, keyPrefix: "otp-verify" }),
  validateBody(verifyOtpSchema),
  blockchainAuth.verifyOtp
);
router.get(
  "/challenge",
  rateLimit({ windowMs: 10 * 60 * 1000, max: 10, keyPrefix: "auth-challenge" }),
  blockchainAuth.challenge
);
router.post(
  "/verify-challenge",
  rateLimit({ windowMs: 10 * 60 * 1000, max: 12, keyPrefix: "challenge-verify" }),
  validateBody(challengeVerifySchema),
  blockchainAuth.verifyChallenge
);

router.get(
  "/invites/:token",
  rateLimit({ windowMs: 10 * 60 * 1000, max: 30, keyPrefix: "invite-validate" }),
  blockchainAuth.validateInvite
);

router.post(
  "/accept-invite",
  protect,
  rateLimit({ windowMs: 10 * 60 * 1000, max: 10, keyPrefix: "invite-accept" }),
  validateBody(acceptInviteSchema),
  blockchainAuth.acceptInvite
);

module.exports = router;
