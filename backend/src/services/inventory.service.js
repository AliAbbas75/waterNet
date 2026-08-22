const Alert = require("../models/Alert");
const { emit: socketEmit } = require("./socket.service");
const { notifyAdminsOfAlert } = require("./alert.notification.service");

async function checkLowStock(item) {
  if (item.quantity >= item.reorderThreshold) return;

  const existing = await Alert.findOne({
    type: "LOW_INVENTORY",
    inventoryItemId: item._id,
    status: { $in: ["OPEN", "ACK"] }
  });
  if (existing) return;

  const alert = await Alert.create({
    type: "LOW_INVENTORY",
    severity: "WARN",
    inventoryItemId: item._id,
    message: `Low stock for ${item.name}: ${item.quantity} remaining (threshold: ${item.reorderThreshold})`
  });
  socketEmit("alert:new", { alert });
  notifyAdminsOfAlert(alert).catch((err) =>
    console.error("Alert notification error:", err?.message || err)
  );
}

async function autoResolveIfRestocked(item) {
  if (item.quantity < item.reorderThreshold) return;

  await Alert.updateMany(
    { type: "LOW_INVENTORY", inventoryItemId: item._id, status: { $in: ["OPEN", "ACK"] } },
    { status: "RESOLVED", resolvedAt: new Date() }
  );
}

async function resolveAlertsForDeletedItem(inventoryItemId) {
  await Alert.updateMany(
    { type: "LOW_INVENTORY", inventoryItemId, status: { $in: ["OPEN", "ACK"] } },
    { status: "RESOLVED", resolvedAt: new Date() }
  );
}

module.exports = { checkLowStock, autoResolveIfRestocked, resolveAlertsForDeletedItem };
