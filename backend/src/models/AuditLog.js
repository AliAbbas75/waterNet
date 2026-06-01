const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      index: true
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    ip: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    meta: {
      type: Object,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
