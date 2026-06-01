const mongoose = require("mongoose");

const publicIssueReportSchema = new mongoose.Schema(
  {
    plantId: { type: mongoose.Schema.Types.ObjectId, ref: "Plant", default: null, index: true },
    locationText: { type: String, default: null },
    category: {
      type: String,
      enum: ["QUALITY", "AVAILABILITY", "DEVICE", "OTHER"],
      required: true,
      index: true
    },
    description: { type: String, required: true },
    contact: { type: String, default: null },
    status: {
      type: String,
      enum: ["OPEN", "IN_REVIEW", "CLOSED"],
      default: "OPEN",
      index: true
    },
    submittedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    reviewedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PublicIssueReport", publicIssueReportSchema);
