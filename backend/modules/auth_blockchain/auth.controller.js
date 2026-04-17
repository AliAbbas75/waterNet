const authService = require("./auth.service");

exports.challenge = async (req, res, next) => {
  try {
    const { wallet } = req.body;
    const challenge = await authService.createChallenge({ wallet });
    res.json(challenge);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { wallet, challengeId, signature } = req.body;
    const result = await authService.loginWithSignature({ wallet, challengeId, signature });
    res.json(result);
  } catch (err) {
    next(err);
  }
};
