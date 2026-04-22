# WaterNet — Team Board (High-level)

This is a lightweight snapshot board. Details live in each owner tracker.

Reference: [plan.md](../plan.md)

## Milestone progress (verified against plan.md)

Status legend:
- **Completed** = meets the milestone “Done when” in [plan.md](../plan.md)
- **In progress** = code exists but the “Done when” is not fully met (or key gaps remain)
- **Not started** = no meaningful implementation found yet

| Milestone | Status | Evidence in repo | Notes / gaps vs plan.md “Done when” |
|---|---|---|---|
| A — Backend Foundation | **Completed** | `backend/src/index.js`, `backend/src/middleware/*`, `backend/src/routes/auth.routes.js`, `backend/src/routes/admin.routes.js` | Protected routes + role checks present. |
| B — Device & Plant Mgmt | **Completed** | `backend/src/models/Plant.js`, `backend/src/routes/plant.routes.js`, `backend/src/controllers/plant.controller.js`; `backend/src/models/Device.js`, `backend/src/routes/device.routes.js`, `backend/src/controllers/device.controller.js` | Admin can create plants/devices + install/uninstall (assign device to plant). (Plants POST was smoke-tested.) |
| C — IoT Data Acquisition | **In progress** | `backend/src/services/mqtt.service.js`, `backend/src/models/TelemetryReading.js` | Telemetry/health persistence + `lastSeenAt` update + LWT handler exist. **Missing** mTLS/CN enforcement (plan requires mapping `deviceId` from cert CN). |
| D — Water Quality Analysis | **In progress** | `backend/src/controllers/analysis.controller.js`, `backend/src/models/ThresholdConfig.js`, `backend/src/models/WaterQualityState.js`, `backend/src/routes/analysis.routes.js` | Analysis + state model exist, but “latest plant status updates after telemetry arrives” is not confidently satisfied due to `deviceId` shape mismatch (telemetry stores string `deviceId`, analysis queries by `deviceId` as ObjectId). |
| E — Alerts & Notification | **In progress** | `backend/src/models/Alert.js`, `backend/src/controllers/alert.controller.js`, `backend/src/routes/alert.routes.js` | Alerts exist (quality unsafe/device offline/low inventory), but quality-alert path depends on Milestone D being correct; also alert routes are ADMIN-only (plan expects ack by admin/maintainer). |
| F — Maintenance & Task Mgmt | **In progress** | `backend/src/models/MaintenanceTask.js`, `backend/src/models/MaintenanceLog.js`, `backend/src/controllers/maintenance.controller.js`, `backend/src/routes/maintenance.routes.js` | CRUD/log/resolve exist and resolve decrements inventory in a transaction, but “maintainer can complete a task with logs” is blocked by auth wiring gaps (maintainer routes don’t ensure `protect` runs) and soft-handoff is marked TODO. |
| G — Inventory Management | **Completed** | `backend/src/models/InventoryItem.js`, `backend/src/controllers/inventory.controller.js`, `backend/src/routes/inventory.routes.js` | Inventory list + low-stock alert creation logic present. |
| H — Admin Dashboard | **Not started** | `frontend/src/*` (currently auth test pages only) | No admin dashboard pages implemented yet. |
| I — Maintainer Interface | **Not started** | `frontend/src/*` (currently auth test pages only) | No maintainer UI implemented yet. |
| J — Public User App | **Not started** | `frontend/src/*` (currently auth test pages only) | No public UI implemented yet. |
| K — Reporting & Visualization | **Not started** | (no `reports` module/routes found) | Reporting endpoints not implemented yet. |
| L — Blockchain Auth (Deferred) | **Deferred** | `backend/modules/auth_blockchain/*` (early stub) | Intentionally deferred per plan. |

## Milestones and owners
- [x] Milestone A (Backend Foundation) — Shared (completed: RBAC + request validation + logging/requestId + protected admin route)
- [x] Milestone B (Device & Plant Management) — Farrukh
- [ ] Milestone C (IoT Data Acquisition, MQTT+mTLS) — Farrukh
- [ ] Milestone D (Water Quality Analysis) — Ali
- [ ] Milestone E (Alert & Notification) — Ali
- [ ] Milestone F (Maintenance & Task Management) — Farrukh
- [x] Milestone G (Inventory Management) — Ali
- [ ] Milestone H (Admin Dashboard) — Asmara
- [ ] Milestone I (Maintainer Interface) — Farrukh
- [ ] Milestone J (Public User App) — Asmara
- [ ] Milestone K (Reporting & Visualization) — Asmara
- [ ] Milestone L (Blockchain-based Authentication) — Ali (Deferred)

## Handshake points (avoid blockers)
- B → C: device registry + disabled flag must exist before strict CN enforcement
- C → D: analysis needs telemetry persistence
- D → E: alerts depend on state transitions
- F ↔ G: inventory decrement triggered on task resolve
- D/E/F/G → H: admin dashboard consumes all operational data
- D/C → I: maintainer UI shows recent readings

## Update cadence (suggested)
- Each owner updates their tracker weekly.
- Team board is updated only when a milestone is checked off.
