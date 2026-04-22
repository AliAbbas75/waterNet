# WaterNet — Team Board (High-level)

This is a lightweight snapshot board. Details live in each owner tracker.

Reference: [plan.md](../plan.md)

## Milestones and owners
- [x] Milestone A (Backend Foundation) — Shared (completed: RBAC + request validation + logging/requestId + protected admin route)
- [ ] Milestone B (Device & Plant Management) — Farrukh
- [ ] Milestone C (IoT Data Acquisition, MQTT+mTLS) — Farrukh
- [ ] Milestone D (Water Quality Analysis) — Ali
- [ ] Milestone E (Alert & Notification) — Ali
- [ ] Milestone F (Maintenance & Task Management) — Farrukh
- [ ] Milestone G (Inventory Management) — Ali
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
