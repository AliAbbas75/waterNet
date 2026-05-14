const express = require("express");
const authController = require("../controllers/auth.controller");
const protect = require("../middleware/protect");
const { z, validateBody } = require("../middleware/validate");

const router = express.Router();

const loginSchema = z.object({
	token: z.string().min(1),
	walletAddress: z.string().min(1)
});

const devLoginSchema = z
	.object({
		email: z.string().min(1).optional(),
		walletAddress: z.string().min(1).optional()
	})
	.refine((d) => Boolean(d.email || d.walletAddress), {
		message: "email or walletAddress is required"
	});

router.post("/login", validateBody(loginSchema), authController.login);
router.post("/dev-login", validateBody(devLoginSchema), authController.devLogin);
router.get("/dev-users", authController.devUsers);
router.get("/me", protect, authController.me);
router.post("/logout", protect, authController.logout);

module.exports = router;
