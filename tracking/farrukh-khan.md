# Progress Tracker — Farrukh Khan

Owner modules:
- Device and Filter Installation Management Module
- IoT Data Acquisition Module
- Maintenance and Task Management Module
- Maintainer Interface Module

Milestone mapping (see [plan.md](../plan.md)):
- Milestone B — Device & Plant Management
- Milestone C — IoT Data Acquisition (MQTT + mTLS)
- Milestone F — Maintenance & Task Management
- Milestone I — Maintainer Interface

## Status (edit as you go)
- Current focus:
- Blockers:
- Next milestone target:

## Checklist — Milestone B (Device & Plant Management)
- [ ] Implement `Plant` model + admin CRUD
- [ ] Implement `Device` model (unique `deviceId`)
- [ ] Install/uninstall flow (assign device to plant)
- [ ] Device state fields needed by IoT + dashboards:
  - disabled flag (manual disable in DB)
  - lastSeenAt
  - availability state (derived)
- [ ] List/search endpoints by status and plant

## Checklist — Milestone C (IoT Data Acquisition)
Locked decisions summary:
- MQTT broker: EMQX Serverless
- Transport security: MQTT over TLS with mTLS
- Identity mapping: `deviceId` extracted from certificate CN (authoritative)
- Heartbeat: every 2 minutes
- Offline grace window: 5–6 minutes (≈ 3 missed heartbeats)
- LWT: mark device unavailable on unexpected disconnect
- Retained messages: backend publishes retained latest metrics + online status after validation
- Disabled device handling: still ingest telemetry, mark as disabled; hidden by default in dashboards

Tasks:
- [ ] Define topic naming + payload schema (`schemaVersion`, timestamps)
- [ ] Implement backend MQTT consumer/subscriber
- [ ] Enforce CN-to-deviceId mapping (reject mismatch)
- [ ] Persist telemetry readings + health heartbeats
- [ ] Availability rules engine (heartbeat + LWT + grace window)
- [ ] Publish retained “latest metrics” and “Online” status from backend
- [ ] Write local simulation notes (how to test with a client certificate)

### API contracts needed by UI
- A simple status endpoint (or query) for dashboards:
  - latest telemetry summary
  - availability state
  - lastSeenAt

## Checklist — Milestone F (Maintenance & Task Management)
- [ ] Implement `MaintenanceTask` and `MaintenanceLog` schemas
- [ ] Admin: create task + assign/reassign
- [ ] Maintainer: list mine + start (IN_PROGRESS)
- [ ] Maintainer: add log entries
- [ ] Resolve endpoint sets resolvedAt and triggers inventory decrement
- [ ] Soft handoff reassignment policy (IN_PROGRESS):
  - mandatory progress + used materials log by current technician
  - ADMIN approval triggers reassignment
  - immutable handoff log entry
- [ ] Inventory decrement on resolve using MongoDB transaction

## Checklist — Milestone I (Maintainer Interface)
- [ ] Tasks list (mine)
- [ ] Task detail: device/plant + recent readings
- [ ] Update status to IN_PROGRESS
- [ ] Add maintenance log + materials
- [ ] Resolve task flow

## Weekly update log
### Week of YYYY-MM-DD
- Done:
- Next:
- Blocked:
