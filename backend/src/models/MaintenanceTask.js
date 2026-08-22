const mongoose = require("mongoose");

const maintenanceTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    status: {
      type: String,
      // TRIAGE: raised but not yet routed. Owned by every admin rather than one
      // person — auto-assigning to a single admin looks like ownership but is a
      // dead end if they are asleep.
      // BLOCKED: started, waiting on parts or site access; keeps the clock visible.
      enum: ['TRIAGE', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'RESOLVED', 'CANCELLED'],
      default: 'TRIAGE'
    },
    // Null while in TRIAGE. A system-raised ticket has no owner until an admin
    // routes it, and inventing one would misrepresent who is accountable.
    assignedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // Null when the system raised the ticket. Deliberately not a reserved
    // "system user": that account would surface in the assignee picker and in
    // user administration, which is worse than an explicit null plus `origin`.
    assignedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    origin: {
      type: String,
      enum: ['MANUAL', 'SYSTEM'],
      default: 'MANUAL'
    },
    // Mirrors the severity of the alert that raised this, so the queue can sort
    // and the triage deadline has something to derive from.
    severity: {
      type: String,
      enum: ['INFO', 'MINOR', 'MAJOR', 'CRITICAL'],
      default: 'MINOR'
    },
    // When triage should have happened. An unassigned critical ticket past this
    // is itself an incident, which is what makes the deadline more than decoration.
    triageDueAt: {
      type: Date,
      default: null
    },
    triagedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    triagedAt: {
      type: Date,
      default: null
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    plantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      default: null
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      default: null
    },
    externalRef: {
      type: mongoose.Schema.Types.Mixed, // e.g., { type, id }
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolvedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolutionSummary: {
      type: String,
      default: null
    },
    // Required steps for safety-critical work, carried from the alert policy.
    // Stored now so the record is complete; enforcement at closure lands with
    // the safety workflow.
    checklist: [{
      label: { type: String, required: true },
      done: { type: Boolean, default: false },
      completedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      completedAt: { type: Date, default: null }
    }],
    materials: [{
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
      quantity: { type: Number, required: true },
      name: { type: String, required: true } // denormalize for history
    }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaintenanceTask", maintenanceTaskSchema);