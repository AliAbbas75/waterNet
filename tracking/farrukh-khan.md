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
- Current focus: Completed all Farrukh's milestones (B, C, D, E, F, G, I)
- Blockers: None
- Next milestone target: Ready for vertical slice demo

## Checklist — Milestone B (Device & Plant Management)
- [x] Implement `Plant` model + admin CRUD
- [x] Implement `Device` model (unique `deviceId`)
- [x] Install/uninstall flow (assign device to plant)
- [x] Device state fields needed by IoT + dashboards:
  - disabled flag (manual disable in DB)
  - lastSeenAt
  - availability state (derived)
- [x] List/search endpoints by status and plant

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
- [x] Define topic naming + payload schema (`schemaVersion`, timestamps)
- [x] Implement backend MQTT consumer/subscriber
- [x] Enforce CN-to-deviceId mapping (reject mismatch)
- [x] Persist telemetry readings + health heartbeats
- [x] Availability rules engine (heartbeat + LWT + grace window)
- [x] Publish retained "latest metrics" and "Online" status from backend
- [x] Write local simulation notes (how to test with a client certificate)

### Local Simulation Notes
For development/testing without real devices:
1. Set up a local MQTT broker (e.g., Mosquitto) or use EMQX cloud free tier.
2. Set MQTT_BROKER_URL in .env to the broker URL.
3. Use MQTT client (e.g., mosquitto_pub) to publish test messages:
   - Telemetry: mosquitto_pub -h localhost -t "waternet/v1/devices/test-device/telemetry" -m '{"schemaVersion":"1.0","timestamp":"2024-04-22T12:00:00Z","readings":{"pH":7.2,"turbidity":1.5,"temperature":25,"TDS":150}}'
   - Health: mosquitto_pub -h localhost -t "waternet/v1/devices/test-device/health" -m '{"schemaVersion":"1.0","timestamp":"2024-04-22T12:00:00Z","health":{"uptime":3600,"connectivityStatus":"good"}}'
   - LWT: Configure LWT in device client, or simulate disconnect.
4. For mTLS: Generate client certs with CN=deviceId, configure broker to require mTLS, update service with cert paths.
5. Test availability: Publish health, check device availability, stop publishing, wait 6+ min, check UNAVAILABLE.

### API contracts needed by UI
- A simple status endpoint (or query) for dashboards:
  - latest telemetry summary
  - availability state
  - lastSeenAt

## Checklist — Milestone F (Maintenance & Task Management)
- [x] Implement `MaintenanceTask` and `MaintenanceLog` schemas
- [x] Admin: create task + assign/reassign
- [x] Maintainer: list mine + start (IN_PROGRESS)
- [x] Maintainer: add log entries
- [x] Resolve endpoint sets resolvedAt and triggers inventory decrement
- [x] Soft handoff reassignment policy (IN_PROGRESS):
  - mandatory progress + used materials log by current technician
  - ADMIN approval triggers reassignment
  - immutable handoff log entry
- [x] Inventory decrement on resolve using MongoDB transaction

## Checklist — Milestone I (Maintainer Interface)
- [x] Tasks list (mine)
- [x] Task detail: device/plant + recent readings
- [x] Update status to IN_PROGRESS
- [x] Add maintenance log + materials
- [x] Resolve task flow

## Checklist — Milestone G (Inventory Management)
- [x] Implement `InventoryItem` model + admin CRUD
- [x] Implement low-stock threshold checks
- [x] Generate alerts when below threshold

## Checklist — Milestone D (Water Quality Analysis)
- [x] Implement `ThresholdConfig` model + admin config endpoints
- [x] Write evaluation function (Safe/Warning/Unsafe)
- [x] Store `WaterQualityState` per plant/device
- [x] Add state endpoints for UI to consume

## Checklist — Milestone E (Alert & Notification)
- [x] Alerts created on threshold crossings, device offline, low inventory

## Weekly update log
### Week of YYYY-MM-DD
- Done:
- Next:
- Blocked:
