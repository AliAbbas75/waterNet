const MaintenanceTask = require("../models/MaintenanceTask");
const MaintenanceLog = require("../models/MaintenanceLog");
const User = require("../models/User");
const InventoryItem = require("../models/InventoryItem");
const mongoose = require("mongoose");
const { emit: socketEmit } = require("../services/socket.service");
const { checkLowStock } = require("../services/inventory.service");
const { logAudit } = require("../services/audit.service");
const { clearAdvisory, resolveAlertForTicket } = require("../services/alert.service");
const { assignTicket } = require("../services/ticket.service");
const { statusesForPhase } = require("../services/taskPhase");
const Plant = require("../models/Plant");

// Admin: Create task
exports.createTask = async (req, res, next) => {
  try {
    const { title, description, assignedToUserId, plantId, deviceId, externalRef } = req.body;

    if (!title || !description || !assignedToUserId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check the assignee exists and is someone who can hold work
    const assignee = await User.findById(assignedToUserId);
    if (!assignee || !['MAINTAINER', 'MANAGER', 'ADMIN'].includes(assignee.role)) {
      return res.status(400).json({ error: 'Invalid assignee' });
    }

    const task = new MaintenanceTask({
      title,
      description,
      // Explicit: the model now defaults to TRIAGE for system-raised tickets,
      // but a task created by hand already names its assignee.
      status: 'ASSIGNED',
      origin: 'MANUAL',
      severity: req.body.severity || 'MINOR',
      // A hand-created task belongs to whoever it was written for.
      ownerRole: ['MAINTAINER', 'MANAGER'].includes(assignee.role) ? assignee.role : 'ADMIN',
      assignedToUserId,
      assignedByUserId: req.user._id,
      plantId,
      deviceId,
      externalRef
    });

    await task.save();
    await task.populate(['assignedToUserId', 'assignedByUserId', 'plantId', 'deviceId']);

    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
};

// Admin: Assign/reassign task
exports.assignTask = async (req, res, next) => {
  try {
    const { assignedToUserId, handoffLogId, handoffNote } = req.body;

    if (!assignedToUserId) {
      return res.status(400).json({ error: 'assignedToUserId required' });
    }

    const task = await MaintenanceTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Set when the handoff below already wrote the note to the task log, so the
    // assignment does not write it a second time.
    let handoffLogged = false;

    // If task is IN_PROGRESS, require soft handoff log from current assignee
    if (task.status === 'IN_PROGRESS' && task.assignedToUserId && task.assignedToUserId.toString() !== assignedToUserId) {
      if (!handoffLogId) {
        return res.status(400).json({ error: 'handoffLogId required for reassignment' });
      }

      const handoffLog = await MaintenanceLog.findById(handoffLogId);
      if (!handoffLog || handoffLog.taskId.toString() !== task._id.toString()) {
        return res.status(400).json({ error: 'Invalid handoffLogId' });
      }
      if (handoffLog.authorUserId.toString() !== task.assignedToUserId.toString()) {
        return res.status(400).json({ error: 'Handoff log must be authored by current assignee' });
      }

      await MaintenanceLog.create({
        taskId: task._id,
        authorUserId: req.user._id,
        note: handoffNote ? `Soft handoff: ${handoffNote}` : 'Soft handoff approved',
        structuredFields: {
          type: 'SOFT_HANDOFF',
          fromUserId: task.assignedToUserId,
          toUserId: assignedToUserId,
          handoffLogId: handoffLog._id
        }
      });
      handoffLogged = true;
    }

    // One assignment path, shared with the alert list. Two copies of this
    // drifted until only one of them wrote the audit entry.
    const result = await assignTicket({
      task,
      assignedToUserId,
      actorUserId: req.user._id,
      req,
      note: handoffLogged ? null : handoffNote || null
    });
    if (result.error === 'INVALID_ASSIGNEE') {
      return res.status(400).json({ error: 'Invalid assignee' });
    }
    if (result.error === 'INACTIVE_ASSIGNEE') {
      return res.status(400).json({ error: 'That account is suspended and cannot hold work.' });
    }

    await task.populate(['assignedToUserId', 'assignedByUserId', 'plantId', 'deviceId']);
    res.json({ task });
  } catch (err) {
    next(err);
  }
};

// Admin: Get all tasks
exports.getTasks = async (req, res, next) => {
  try {
    const {
      status,
      phase,
      plantId,
      deviceId,
      severity,
      assignedToUserId,
      origin,
      search,
      attention,
      sort = 'urgent',
      page,
      limit
    } = req.query;

    let query = {};

    // A phase covers several statuses, so it is resolved here rather than each
    // client inventing its own idea of what "pending" includes.
    if (phase) {
      const statuses = statusesForPhase(phase);
      if (!statuses) return res.status(400).json({ error: 'Unknown phase' });
      query.status = { $in: statuses };
    } else if (status) {
      query.status = status;
    }
    if (plantId) query.plantId = plantId;
    if (deviceId) query.deviceId = deviceId;
    if (severity) query.severity = severity;
    if (origin) query.origin = origin;
    if (assignedToUserId) {
      query.assignedToUserId = assignedToUserId === 'none' ? null : assignedToUserId;
    }
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ title: rx }, { description: rx }, { resolutionSummary: rx }];
    }

    // The one filter that answers "what should I do next": work nobody owns,
    // work that stalled, and triage that has blown its deadline.
    if (attention === 'true') {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { status: 'TRIAGE' },
            { status: 'BLOCKED' },
            { status: 'TRIAGE', triageDueAt: { $ne: null, $lt: new Date() } }
          ]
        }
      ];
    }

    const SORTS = {
      // Severity is stored as a word, so ordering it needs a computed rank —
      // an alphabetical sort would put CRITICAL after BLOCKED and MAJOR last.
      urgent: { severityRank: 1, createdAt: 1 },
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      updated: { updatedAt: -1 }
    };
    const sortSpec = SORTS[sort] || SORTS.urgent;

    const pipeline = [
      { $match: query },
      {
        $addFields: {
          severityRank: {
            $switch: {
              branches: [
                { case: { $eq: ['$severity', 'CRITICAL'] }, then: 0 },
                { case: { $eq: ['$severity', 'MAJOR'] }, then: 1 },
                { case: { $eq: ['$severity', 'MINOR'] }, then: 2 }
              ],
              default: 3
            }
          }
        }
      },
      { $sort: sortSpec }
    ];

    // Pagination is opt-in: callers that want the whole set — the plant history
    // card, the dashboard — keep getting it by not asking for a page.
    const perPage = limit ? Math.min(200, Math.max(1, parseInt(limit, 10) || 25)) : null;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);

    const [total, counts, rows] = await Promise.all([
      MaintenanceTask.countDocuments(query),
      // Counts for the whole board, not the current page — a tab that says
      // "Pending 3" when there are 24 is worse than no number at all.
      MaintenanceTask.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      MaintenanceTask.aggregate(
        perPage
          ? [...pipeline, { $skip: (currentPage - 1) * perPage }, { $limit: perPage }]
          : pipeline
      )
    ]);

    const tasks = await MaintenanceTask.populate(rows, [
      { path: 'assignedToUserId', select: 'display_name email role' },
      { path: 'assignedByUserId', select: 'display_name' },
      { path: 'plantId', select: 'name' },
      { path: 'deviceId', select: 'deviceId' }
    ]);

    res.json({
      tasks,
      total,
      page: perPage ? currentPage : 1,
      pages: perPage ? Math.max(1, Math.ceil(total / perPage)) : 1,
      counts: counts.reduce((acc, r) => {
        acc[r._id] = r.n;
        return acc;
      }, {})
    });
  } catch (err) {
    next(err);
  }
};

// Maintainer: Get my tasks
exports.getMyTasks = async (req, res, next) => {
  try {
    const tasks = await MaintenanceTask.find({ assignedToUserId: req.user._id })
      .populate('assignedByUserId', 'display_name')
      .populate('plantId', 'name')
      .populate('deviceId', 'deviceId')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (err) {
    next(err);
  }
};

// Get single task
exports.getTask = async (req, res, next) => {
  try {
    const task = await MaintenanceTask.findById(req.params.id)
      .populate('assignedToUserId', 'display_name')
      .populate('assignedByUserId', 'display_name')
      .populate('plantId', 'name')
      .populate('deviceId', 'deviceId')
      .populate('resolvedByUserId', 'display_name');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check permission: admin or assigned maintainer
    const assignedId = task.assignedToUserId?._id || task.assignedToUserId;
    if (
      req.user.role !== 'SUPER_ADMIN' &&
      req.user.role !== 'ADMIN' &&
      String(assignedId) !== String(req.user._id)
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ task });
  } catch (err) {
    next(err);
  }
};

// Maintainer: Update status to IN_PROGRESS
exports.startTask = async (req, res, next) => {
  try {
    const task = await MaintenanceTask.findOne({
      _id: req.params.id,
      assignedToUserId: req.user._id,
      status: 'ASSIGNED'
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found or cannot start' });
    }

    task.status = 'IN_PROGRESS';
    // Only on the first start: coming back from BLOCKED must not rewrite when
    // the work actually began.
    if (!task.startedAt) task.startedAt = new Date();
    await task.save();

    await logAudit({
      event: 'ticket.started',
      req,
      actorUserId: req.user._id,
      targetType: 'TASK',
      targetId: task._id,
      meta: {
        severity: task.severity,
        // How long it sat between being handed over and being picked up.
        waitedMinutes: task.assignedAt
          ? Math.round((task.startedAt - new Date(task.assignedAt)) / 60000)
          : null
      }
    });

    await task.populate(['assignedToUserId', 'assignedByUserId', 'plantId', 'deviceId']);

    socketEmit("task:updated", { task });
    res.json({ task });
  } catch (err) {
    next(err);
  }
};

/**
 * Park a started task, or bring it back.
 *
 * BLOCKED was in the schema and in every query from the day it was added, but
 * nothing could set it and nothing could leave it: startTask requires ASSIGNED
 * and resolveTask requires IN_PROGRESS, so a blocked task was a dead end. This
 * is the transition that makes the state real in both directions.
 */
exports.setBlocked = async (req, res, next) => {
  try {
    const blocked = req.body?.blocked !== false;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    if (blocked && !reason) {
      return res.status(400).json({
        error: 'Say what is holding this up — a blocked task with no reason cannot be chased.'
      });
    }

    const task = await MaintenanceTask.findOne({
      _id: req.params.id,
      assignedToUserId: req.user._id,
      status: blocked ? 'IN_PROGRESS' : 'BLOCKED'
    });
    if (!task) {
      return res.status(404).json({
        error: blocked
          ? 'Task not found, not yours, or not started yet.'
          : 'Task not found, not yours, or not blocked.'
      });
    }

    task.status = blocked ? 'BLOCKED' : 'IN_PROGRESS';
    task.blockedReason = blocked ? reason : null;
    await task.save();

    await MaintenanceLog.create({
      taskId: task._id,
      authorUserId: req.user._id,
      note: blocked ? `Blocked: ${reason}` : 'Unblocked — back on this.',
      structuredFields: { type: blocked ? 'BLOCKED' : 'UNBLOCKED', reason: reason || null }
    });

    await logAudit({
      event: blocked ? 'ticket.blocked' : 'ticket.unblocked',
      req,
      actorUserId: req.user._id,
      targetType: 'TASK',
      targetId: task._id,
      meta: { reason: reason || null, severity: task.severity }
    });

    await task.populate(['assignedToUserId', 'assignedByUserId', 'plantId', 'deviceId']);
    socketEmit("task:updated", { task });
    res.json({ task });
  } catch (err) {
    next(err);
  }
};

// Add log entry
exports.addLog = async (req, res, next) => {
  try {
    const { note, structuredFields } = req.body;

    if (!note) {
      return res.status(400).json({ error: 'Note required' });
    }

    const task = await MaintenanceTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check permission
    const assignedId = task.assignedToUserId?._id || task.assignedToUserId;
    if (
      req.user.role !== 'SUPER_ADMIN' &&
      req.user.role !== 'ADMIN' &&
      String(assignedId) !== String(req.user._id)
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const log = new MaintenanceLog({
      taskId: task._id,
      authorUserId: req.user._id,
      note,
      structuredFields
    });

    await log.save();
    await log.populate('authorUserId', 'display_name');

    res.status(201).json({ log });
  } catch (err) {
    next(err);
  }
};

// Get logs for task
exports.getLogs = async (req, res, next) => {
  try {
    const task = await MaintenanceTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check permission
    const assignedId = task.assignedToUserId?._id || task.assignedToUserId;
    if (
      req.user.role !== 'SUPER_ADMIN' &&
      req.user.role !== 'ADMIN' &&
      String(assignedId) !== String(req.user._id)
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const logs = await MaintenanceLog.find({ taskId: req.params.id })
      .populate('authorUserId', 'display_name')
      .sort({ createdAt: 1 });

    res.json({ logs });
  } catch (err) {
    next(err);
  }
};

// Resolve task
// Maintainer: tick off a required step. This is where physical work reaches
// the record — completing the CLOSE_PLANT item is what sets the plant closed.
// The system never flips operationalStatus on its own, because a plant is
// closed by someone going there and closing it.
exports.completeChecklistItem = async (req, res, next) => {
  try {
    const { index, done = true } = req.body;

    const task = await MaintenanceTask.findOne({
      _id: req.params.id,
      assignedToUserId: req.user._id,
      status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'BLOCKED'] }
    });
    if (!task) return res.status(404).json({ error: 'Task not found or not yours' });

    const item = task.checklist?.[index];
    if (!item) return res.status(400).json({ error: 'Checklist item not found' });

    item.done = !!done;
    item.completedByUserId = done ? req.user._id : null;
    item.completedAt = done ? new Date() : null;
    await task.save();

    let plantClosed = false;
    if (done && item.effect === 'CLOSE_PLANT' && task.plantId) {
      const plant = await Plant.findById(task.plantId);
      if (plant && plant.operationalStatus !== 'CLOSED') {
        const from = plant.operationalStatus;
        plant.operationalStatus = 'CLOSED';
        await plant.save();
        plantClosed = true;

        await logAudit({
          event: 'plant.closed_by_ticket',
          req,
          actorUserId: req.user._id,
          targetType: 'PLANT',
          targetId: plant._id,
          meta: { from, to: 'CLOSED', ticketId: String(task._id), reason: task.title }
        });
        socketEmit("plant:availability", {
          plantId: plant._id,
          plantName: plant.name,
          operationalStatus: 'CLOSED',
          available: false
        });
      }
    }

    await MaintenanceLog.create({
      taskId: task._id,
      authorUserId: req.user._id,
      note: `${done ? 'Completed' : 'Reopened'}: ${item.label}`,
      structuredFields: { type: 'CHECKLIST', index, effect: item.effect || null, plantClosed }
    });

    await logAudit({
      event: done ? 'ticket.checklist_item_completed' : 'ticket.checklist_item_reopened',
      req,
      actorUserId: req.user._id,
      targetType: 'TASK',
      targetId: task._id,
      meta: { label: item.label, effect: item.effect || null, plantClosed }
    });

    socketEmit("task:updated", { task });
    res.json({ task, plantClosed });
  } catch (err) {
    next(err);
  }
};

exports.resolveTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { resolutionSummary, materials } = req.body;

    const task = await MaintenanceTask.findOne({
      _id: req.params.id,
      assignedToUserId: req.user._id,
      status: 'IN_PROGRESS'
    }).session(session);

    if (!task) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Task not found or cannot resolve' });
    }

    // Safety-critical work carries required steps. Closing the ticket without
    // them would record that the incident was handled when it was not.
    const outstanding = (task.checklist || []).filter((c) => !c.done);
    if (outstanding.length) {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Checklist incomplete',
        outstanding: outstanding.map((c) => c.label)
      });
    }

    if (!resolutionSummary || !String(resolutionSummary).trim()) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'resolutionSummary is required' });
    }

    // Decrement inventory if materials provided
    if (materials && Array.isArray(materials)) {
      for (const mat of materials) {
        const item = await InventoryItem.findById(mat.itemId).session(session);
        if (!item) {
          await session.abortTransaction();
          return res.status(400).json({ error: `Inventory item ${mat.itemId} not found` });
        }
        if (item.quantity < mat.quantity) {
          await session.abortTransaction();
          return res.status(400).json({ error: `Insufficient stock for ${item.name}` });
        }
        item.quantity -= mat.quantity;
        await item.save({ session });
      }
      task.materials = materials;
    }

    task.status = 'RESOLVED';
    task.resolvedAt = new Date();
    task.resolvedByUserId = req.user._id;
    task.resolutionSummary = resolutionSummary || null;
    // A finished task is not still waiting on anything.
    task.blockedReason = null;

    await task.save({ session });
    await session.commitTransaction();

    // Low-stock checks run after commit (outside transaction) — best-effort
    if (materials && Array.isArray(materials)) {
      for (const mat of materials) {
        try {
          const item = await InventoryItem.findById(mat.itemId);
          if (item) await checkLowStock(item);
        } catch (err) {
          console.error("Low-stock check failed after task resolve:", err?.message || err);
        }
      }
    }

    await task.populate(['assignedToUserId', 'assignedByUserId', 'plantId', 'deviceId', 'resolvedByUserId']);

    // The work is done, so the alert that asked for it is done. This is the
    // return leg of dispatch: an admin never has to go back and close the alert
    // by hand, and an alert cannot read as resolved while its work is still open.
    await resolveAlertForTicket(task, {
      actorUserId: req.user._id,
      req,
      summary: task.resolutionSummary
    });

    // The incident is closed out, so the public advisory can be lifted. The
    // plant is deliberately NOT reopened here — putting a water plant back into
    // service is a decision someone makes, not a side effect of paperwork.
    if (task.plantId) {
      await clearAdvisory(task.plantId, {
        actorUserId: req.user._id,
        reason: `ticket ${task._id} resolved`
      });
    }

    socketEmit("task:updated", { task });
    res.json({ task });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};