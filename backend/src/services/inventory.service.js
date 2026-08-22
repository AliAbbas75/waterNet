const { raiseAlert, clearAlerts } = require("./alert.service");

async function checkLowStock(item) {
  if (item.quantity >= item.reorderThreshold) return;

  await raiseAlert({
    type: "LOW_INVENTORY",
    severity: "WARN",
    inventoryItemId: item._id,
    message: `Low stock for ${item.name}: ${item.quantity} remaining (threshold: ${item.reorderThreshold})`,
    meta: { quantity: item.quantity, reorderThreshold: item.reorderThreshold }
  });
}

async function autoResolveIfRestocked(item) {
  if (item.quantity < item.reorderThreshold) return;

  await clearAlerts({
    type: "LOW_INVENTORY",
    inventoryItemId: item._id,
    reason: `restocked to ${item.quantity}`
  });
}

async function resolveAlertsForDeletedItem(inventoryItemId) {
  await clearAlerts({
    type: "LOW_INVENTORY",
    inventoryItemId,
    reason: "inventory item deleted"
  });
}

module.exports = { checkLowStock, autoResolveIfRestocked, resolveAlertsForDeletedItem };
