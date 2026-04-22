const MaintenanceTask = require("../models/MaintenanceTask");
const MaintenanceLog = require("../models/MaintenanceLog");
const User = require("../models/User");
const InventoryItem = require("../models/InventoryItem");
const mongoose = require("mongoose");

// Admin: Create task
exports.createTask = async (req, res, next) => {
  try {
    const { title, description, assignedToUserId, plantId, deviceId, externalRef } = req.body;

    if (!title || !description || !assignedToUserId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check assignee exists and is MAINTAINER or ADMIN
    const assignee = await User.findById(assignedToUserId);
    if (!assignee || !['MAINTAINER', 'ADMIN'].includes(assignee.role)) {
      return res.status(400).json({ error: 'Invalid assignee' });
    }

    const task = new MaintenanceTask({
      title,
      description,
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
    const { assignedToUserId } = req.body;

    if (!assignedToUserId) {
      return res.status(400).json({ error: 'assignedToUserId required' });
    }

    const task = await MaintenanceTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // If task is IN_PROGRESS, require soft handoff
    if (task.status === 'IN_PROGRESS') {
      // Check if current assignee provided handoff log
      // For simplicity, assume admin can reassign, but in full impl, check logs
      // TODO: implement soft handoff logic
    }

    // Check new assignee
    const assignee = await User.findById(assignedToUserId);
    if (!assignee || !['MAINTAINER', 'ADMIN'].includes(assignee.role)) {
      return res.status(400).json({ error: 'Invalid assignee' });
    }

    task.assignedToUserId = assignedToUserId;
    task.assignedByUserId = req.user._id;
    task.assignedAt = new Date();

    await task.save();
    await task.populate(['assignedToUserId', 'assignedByUserId', 'plantId', 'deviceId']);

    res.json({ task });
  } catch (err) {
    next(err);
  }
};

// Admin: Get all tasks
exports.getTasks = async (req, res, next) => {
  try {
    const { status, plantId, deviceId } = req.query;
    let query = {};

    if (status) query.status = status;
    if (plantId) query.plantId = plantId;
    if (deviceId) query.deviceId = deviceId;

    const tasks = await MaintenanceTask.find(query)
      .populate('assignedToUserId', 'display_name')
      .populate('assignedByUserId', 'display_name')
      .populate('plantId', 'name')
      .populate('deviceId', 'deviceId')
      .sort({ createdAt: -1 });

    res.json({ tasks });
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
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && task.assignedToUserId.toString() !== req.user._id.toString()) {
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
    await task.save();
    await task.populate(['assignedToUserId', 'assignedByUserId', 'plantId', 'deviceId']);

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
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && task.assignedToUserId.toString() !== req.user._id.toString()) {
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
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && task.assignedToUserId.toString() !== req.user._id.toString()) {
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

    await task.save({ session });
    await session.commitTransaction();

    await task.populate(['assignedToUserId', 'assignedByUserId', 'plantId', 'deviceId', 'resolvedByUserId']);

    res.json({ task });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};