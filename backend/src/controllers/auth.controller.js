exports.me = async (req, res) => {
  res.json({ ok: true, user: req.user });
};

exports.logout = async (_req, res) => {
  res.json({ ok: true });
};
