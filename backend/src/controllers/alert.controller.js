const Alert = require("../models/Alert");
const MaintenanceTask = require("../models/MaintenanceTask");
const {
  dispatchAlert: dispatch,
  resolveAlert: resolve
} = require("../services/alert.service");

// The work order is shown on the alert row, so the list has to carry enough of
// it to answer "who has this?" without a second request per alert.
const TICKET_POPULATE = {
  path: "ticketId",
  select: "title status severity ownerRole triageDueAt assignedToUserId recurrenceCount",
  populate: { path: "assignedToUserId", select: "display_name email role" }
};

const PLANT_POPULATE = {
  path: "plantId",
  select: "name coveringMaintainerId",
  populate: { path: "coveringMaintainerId", select: "display_name email role active" }
};

function populate(id) {
  return Alert.findById(id)
    .populate(PLANT_POPULATE)
    .populate("deviceId", "deviceId")
    .populate("inventoryItemId", "name")
    .populate(TICKET_POPULATE);
}

// WARN retained so alerts written before the ladder change still sort sanely.
const SEVERITY_ORDER = { CRITICAL: 0, MAJOR: 1, WARN: 1, MINOR: 2, INFO: 3 };

exports.getAlerts = async (req, res, next) => {
  try {
    const { status, type, severity, plantId, deviceId } = req.query;
    let query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (severity) query.severity = severity;
    if (plantId) query.plantId = plantId;
    if (deviceId) query.deviceId = deviceId;

    // Staff who hold work see the alerts behind their own tickets, not the
    // whole network's. The global list is an operations view; their surface is
    // the work they have been assigned, with severity on every row.
    if (['MAINTAINER', 'MANAGER'].includes(req.user.role)) {
      const myTickets = await MaintenanceTask.find({
        assignedToUserId: req.user._id,
        status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'BLOCKED'] },
        'externalRef.type': 'ALERT'
      }).select('externalRef').lean();

      query._id = { $in: myTickets.map((t) => t.externalRef?.id).filter(Boolean) };
    }

    const alerts = await Alert.find(query)
      .populate(PLANT_POPULATE)
      .populate('deviceId', 'deviceId')
      .populate('inventoryItemId', 'name')
      .populate(TICKET_POPULATE)
      .sort({ createdAt: -1 });

    // Sort CRITICAL first, then MAJOR, then MINOR, preserving time order within each group
    alerts.sort((a, b) => {
      const sd = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
      if (sd !== 0) return sd;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({ alerts });
  } catch (err) {
    next(err);
  }
};

// The primary path: hand the alert to a person. This is what "resolving" an
// alert actually means operationally — someone is now on it — and it replaces
// the one-click close that let alerts disappear with nobody doing anything.
exports.dispatchAlert = async (req, res, next) => {
  try {
    const { assignedToUserId } = req.body || {};
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (!assignedToUserId) {
      return res.status(400).json({ error: 'Choose who this is going to.' });
    }

    const result = await dispatch({
      alertId: req.params.id,
      assignedToUserId,
      note: note || null,
      user: req.user,
      req
    });

    if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Alert not found' });
    if (result.error === 'ALREADY_RESOLVED') {
      return res.status(409).json({ error: 'Alert is already resolved' });
    }
    if (result.error === 'INVALID_ASSIGNEE') {
      return res.status(400).json({ error: 'That person cannot hold a work order.' });
    }
    if (result.error === 'INACTIVE_ASSIGNEE') {
      return res.status(400).json({ error: 'That account is suspended and cannot hold work.' });
    }
    if (result.error === 'NO_TICKET') {
      return res.status(400).json({ error: 'This alert type does not raise work orders.' });
    }

    const alert = await populate(result.alert._id);
    res.json({
      alert,
      ticketId: String(result.ticket._id),
      assignedTo: result.assignee.display_name || result.assignee.email
    });
  } catch (err) {
    next(err);
  }
};

exports.resolveAlert = async (req, res, next) => {
  try {
    // Closing an alert by hand costs a sentence. Enforced here and not only in
    // the UI: a rule that lives in the form is not a rule, it is a suggestion
    // that any direct API call ignores.
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note) {
      return res.status(400).json({
        error: 'A reason is required to close an alert without dispatching it.'
      });
    }
    const result = await resolve({ alertId: req.params.id, user: req.user, req, note });
    if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Alert not found' });
    if (result.error === 'ALREADY_RESOLVED') {
      return res.status(409).json({ error: 'Alert is already resolved' });
    }
    const alert = await populate(result.alert._id);
    res.json({
      alert,
      cancelledTicketId: result.cancelledTicket ? String(result.cancelledTicket._id) : null
    });
  } catch (err) {
    next(err);
  }
};
