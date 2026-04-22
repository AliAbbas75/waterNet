# Progress Tracker — Asmara Kanwal

Owner modules:
- Administrator Dashboard Module
- Public User Application Module
- Reporting and Visualization Module

Milestone mapping (see [plan.md](../plan.md)):
- Milestone H — Admin Dashboard
- Milestone J — Public User App
- Milestone K — Reporting & Visualization

## Status (edit as you go)
- Current focus:
- Blockers:
- Next milestone target:

## Checklist — Milestone H (Admin Dashboard)
Goal: admins can monitor plants/devices, see alerts, manage inventory, and manage maintenance.

- [ ] Decide UI pages + minimal navigation:
  - Overview (current status)
  - Plants/Devices
  - Alerts
  - Inventory
  - Maintenance
  - Threshold configuration
- [ ] Wire to backend endpoints (agree on response shapes)
- [ ] Role-aware UI for `SUPER_ADMIN` vs `ADMIN` (if differences are needed)
- [ ] Default view should hide disabled-device telemetry
- [ ] Add an audit/troubleshooting view that can include disabled devices (ADMIN/SUPER_ADMIN)

### Required backend contracts (dependency handshake)
- Plants/devices list endpoints
- Plant/device state endpoint(s)
- Alerts list + ack
- Inventory list + CRUD
- Maintenance tasks list + create/assign
- ThresholdConfig endpoints

## Checklist — Milestone J (Public User App)
Goal: citizens can see nearby plants and current status, and submit issue reports.

- [ ] Nearby plants list (location-based)
- [ ] Plant detail page (status + availability)
- [ ] Issue report submission
- [ ] Confirm whether public users need auth or anonymous reporting is allowed

## Checklist — Milestone K (Reporting & Visualization)
Goal: trends and performance metrics for decision support.

- [ ] Define minimal report screens:
  - Water quality trends per plant/device
  - Uptime/availability summary
  - Maintenance performance (MTTR, resolved counts)
- [ ] Agree on KPI formulas and time windows (7d/30d/custom)
- [ ] Integrate charting (keep MVP simple)

## Weekly update log
### Week of YYYY-MM-DD
- Done:
- Next:
- Blocked:
