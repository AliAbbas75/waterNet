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
    // Generic target so one log can carry the history of any entity, not just
    // users. Alert and ticket transitions were previously unauditable because
    // there was nowhere to record what they happened to.
    targetType: {
      type: String,
      enum: ["USER", "ALERT", "TASK", "PLANT", "DEVICE", "INVENTORY"],
      default: null,
      index: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
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
