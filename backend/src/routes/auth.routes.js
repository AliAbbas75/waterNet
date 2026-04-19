const express = require("express");
const authController = require("../controllers/auth.controller");
const protect = require("../middleware/protect");

const router = express.Router();

router.post("/login", authController.login);
router.get("/me", protect, authController.me);
router.post("/logout", protect, authController.logout);

module.exports = router;
