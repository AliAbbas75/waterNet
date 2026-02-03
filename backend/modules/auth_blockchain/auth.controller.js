exports.login = async (req, res) => {
  const { wallet } = req.body;

  if (!wallet) return res.status(400).json({ error: "Wallet required" });

  const token = await authService.handleLogin(wallet);

  res.json(token);
};
