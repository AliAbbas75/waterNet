const User = require("../models/User");

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "MAINTAINER", "PUBLIC"];

exports.listUsers = async (req, res, next) => {
  try {
    const { role, active, search } = req.query;
    const query = {};
    if (role) query.role = role;
    if (active === "true" || active === "false") query.active = active === "true";
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ display_name: rx }, { email: rx }, { wallet_address: rx }];
    }
    const users = await User.find(query).sort({ role: 1, createdAt: -1 });
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (role === "SUPER_ADMIN" && req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Only SUPER_ADMIN can grant SUPER_ADMIN" });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

exports.toggleActive = async (req, res, next) => {
  try {
    const { active } = req.body || {};
    if (typeof active !== "boolean") {
      return res.status(400).json({ error: "active must be boolean" });
    }
    if (String(req.user._id) === String(req.params.id) && !active) {
      return res.status(400).json({ error: "Cannot disable your own account" });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { active },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};
