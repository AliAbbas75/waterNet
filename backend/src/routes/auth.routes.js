const express = require("express");
const authController = require("../controllers/auth.controller");
const protect = require("../middleware/protect");
const { z, validateBody } = require("../middleware/validate");

const router = express.Router();

const loginSchema = z.object({
	token: z.string().min(1),
	walletAddress: z.string().min(1)
});

router.post("/login", validateBody(loginSchema), authController.login);
router.get("/me", protect, authController.me);
router.post("/logout", protect, authController.logout);

module.exports = router;
