const jwt = require("jsonwebtoken");
const User = require("../shared/models/User");

exports.handleLogin = async (wallet) => {
  let user = await User.findOne({ wallet });

  if (!user) {
    user = await User.create({
      wallet,
      role: "public" // default role
    });
  }

  return jwt.sign(
    { id: user._id, role: user.role, wallet },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};
