const express = require("express");
const authController = require("./auth.controller");

const router = express.Router();

router.post("/challenge", authController.challenge);
router.post("/login", authController.login);

module.exports = router;