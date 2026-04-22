# WaterNet — Implementation Plan (Milestones + Task Breakdown)

Date: 2026-04-21

This plan turns the proposed layered architecture and module list into a dependency-aware implementation flow. It prioritizes delivering an end-to-end vertical slice early (IoT ingestion → analysis → alerts → maintenance → dashboards) while keeping modules loosely coupled.

## 1) Architecture (Layers + Responsibilities)

### 1.1 Sensing Layer (IoT Nodes)
- Read sensors: pH, turbidity, temperature, TDS (and optional flow/availability inputs)
- Basic validation on device (range checks, missing sensor detection)
- Send telemetry at fixed intervals + health metrics (uptime, RSSI, firmware, last reboot)
- Secure transport to backend (MQTT over TLS with mTLS)
- Availability strategy: 2-minute heartbeat + MQTT Last Will and Testament (LWT) to flag devices unavailable on unexpected disconnects

### 1.2 Application Layer (Backend)
- Ingestion + validation + normalization of sensor payloads
- Persistence (raw telemetry + derived states)
- Threshold-based evaluation (Safe/Warning/Unsafe)
- Alerts generation + notification routing
- Task creation / assignment for maintenance
- Reporting queries (history, performance, uptime)

### 1.3 Presentation Layer (Web + Mobile/PWA)
- Admin dashboard: monitoring + configuration (thresholds, hours, roles) + oversight (inventory, maintenance)
- Maintainer interface: task queue, status updates, maintenance logs
- Public app: nearby plants, current status/availability, issue reporting

---

## 2) Module Dependency Map (Build Order Rationale)

### 2.1 “Foundation” modules (shared by many)
1) Identity & Access (Auth + roles)
2) Organization/Locations (filter plants, geo, ownership)
3) Devices (IoT device registry, installation mapping)
4) Telemetry storage (sensor readings + health)

### 2.2 “Decision” modules (derive meaning)
5) Water Quality Analysis (thresholds → state)
6) Alerts & Notifications (state changes → alerts)

### 2.3 “Operations” modules (human workflows)
7) Maintenance & Task Management (admin assigns, maintainer resolves)
8) Inventory Management (stock + installed/faulty/maintenance)

### 2.4 “Experience” modules (UIs)
9) Admin Dashboard
10) Maintainer Interface
11) Public User App

### 2.5 “Insights” module
12) Reporting & Visualization

### 2.6 Blockchain-based Authentication (optional / later)
- Treat as a future enhancement. The current goal is simple UX; blockchain can be used for step-up auth, tamper-evident audit, or device identity without forcing all users into wallet flows.

---

## 3) Data Model (Backend) — Minimum Viable Schemas

Design principle: keep link fields nullable so modules can ship independently (e.g., maintenance tasks can exist before “faults” exist).

### 3.1 Core entities
- `User`
  - `walletAddress` (canonical identifier if using embedded wallet auth)
  - `role`: `SUPER_ADMIN | ADMIN | MAINTAINER | PUBLIC`
  - profile fields as needed

- `Plant` (Filter installation / site)
  - name, address, geo (lat/lng)
  - operational status
  - operating hours (optional)

- `Device`
  - `deviceId` (unique)
  - `plantId` (nullable if uninstalled)
  - install date, status (`AVAILABLE | INSTALLED | FAULTY | MAINTENANCE`)
  - firmware version, lastSeenAt

### 3.2 Telemetry + analysis
- `TelemetryReading`
  - `deviceId`, `plantId` (denormalize for querying)
  - timestamp
  - readings: pH, turbidity, temperature, TDS
  - health: uptime, connectivity status
  - `ingestMeta`: source IP, protocol, schema version

- `ThresholdConfig`
  - per-parameter ranges (safe/warn/unsafe bands)
  - scope: global default + optional per-plant overrides

- `WaterQualityState`
  - `plantId`, `deviceId`
  - latest category: `SAFE | WARNING | UNSAFE | NO_DATA`
  - reason codes (which parameter triggered)
  - lastEvaluatedAt

### 3.3 Alerts + issues
- `Alert`
  - `type`: quality unsafe, availability change, device offline, low inventory
  - `severity`: info/warn/critical
  - `plantId`, `deviceId`
  - `status`: open/ack/resolved
  - `createdAt`, `ackAt`, `resolvedAt`

- `PublicIssueReport`
  - `plantId` (nullable if user only provides location text)
  - category: quality/availability/device
  - description
  - status: open/in_review/closed

### 3.4 Maintenance
- `MaintenanceTask`
  - title, description
  - `status`: `ASSIGNED | IN_PROGRESS | RESOLVED` (optionally `CANCELLED`)
  - assignment: `assignedToUserId`, `assignedByUserId`, `assignedAt`
  - linking (nullable): `plantId`, `deviceId`, `externalRef` (e.g., `{ type, id }`)
  - resolution: `resolvedAt`, `resolvedByUserId`, `resolutionSummary`
  - timestamps

- `MaintenanceLog`
  - `taskId`, `authorUserId`
  - note, optional structured fields
  - createdAt

### 3.5 Inventory
- `InventoryItem`
  - category: device/sensor/filter unit
  - status: available/installed/faulty/maintenance
  - counts + reorder threshold

---

## 4) API Design (REST) — Minimal Contract per Module

Principle: stable endpoints, strict validation, and role-based access control.

### 4.1 IoT ingestion (MQTT)
Ingestion uses MQTT with mTLS (mutual TLS) between devices and the broker.

- MQTT broker: EMQX Serverless (free-tier for MVP)

- MQTT topics (example shape; finalize later):
  - `waternet/v1/devices/{deviceId}/telemetry`
  - `waternet/v1/devices/{deviceId}/health` (heartbeat)
- Retained messages:
  - Retain the latest water quality metrics and device "Online" status so dashboards load instantly for new subscribers.
- QoS: start with QoS 1 for telemetry/health (at-least-once)
- Payload: JSON with a `schemaVersion` and timestamp

Identity + security:
- Extract `deviceId` from the client certificate Common Name (CN) and enforce it server-side.
- Ignore/override any `deviceId` claimed by the payload/topic if it conflicts with the certificate identity.

Backend responsibilities:
- Subscribes to telemetry/health topics
- Validates schema version, required fields, timestamp skew
- Stores raw telemetry + health updates
- Triggers analysis pipeline (sync for MVP, async later)
- Updates availability using:
  - Heartbeat cadence (every 2 minutes)
  - LWT-based offline events (device marks itself “unavailable” if it drops unexpectedly)
  - Offline grace window: 5–6 minutes (≈ 3 missed heartbeats) before marking unavailable due to missing heartbeats (to tolerate network jitter)

### 4.2 Analysis
- `POST /api/analysis/evaluate` (internal)
- `GET /api/plants/:id/state` (admin/maintainer/public read)

### 4.3 Alerts
- `GET /api/alerts` (admin)
- `PATCH /api/alerts/:id/ack` (admin/maintainer)

### 4.4 Maintenance
- Admin:
  - `POST /api/maintenance/tasks`
  - `PATCH /api/maintenance/tasks/:id/assign`
  - `GET /api/maintenance/tasks`
- Maintainer:
  - `GET /api/maintenance/tasks/mine`
  - `PATCH /api/maintenance/tasks/:id/status`
  - `POST /api/maintenance/tasks/:id/logs`
  - `POST /api/maintenance/tasks/:id/resolve`

### 4.5 Inventory
- `GET /api/inventory`
- `POST /api/inventory/items` (admin)
- `PATCH /api/inventory/items/:id` (admin)

### 4.6 Public
- `GET /api/public/plants/nearby?lat=&lng=&radius=`
- `GET /api/public/plants/:id/status`
- `POST /api/public/reports` (issue reporting)

### 4.7 Reporting
- `GET /api/reports/quality/trends`
- `GET /api/reports/maintenance/performance`
- `GET /api/reports/uptime`

---

## 5) Milestones (Implementation Flow)

Each milestone includes: deliverables, step-by-step tasks, and a “definition of done”.

### Milestone A — Backend Foundation (Project + Cross-cutting)
Deliverables:
- Express app structure, env config, DB connection, error handling
- RBAC middleware (Admin/Maintainer/Public)
- Request validation (schema-based)

Tasks:
1) Confirm folder conventions for backend modules
2) Standardize response envelope + error format
3) Implement role guard helpers (e.g., `requireRole('ADMIN')`, `requireRole('SUPER_ADMIN')`)
4) Add logging + request id

Done when:
- A protected route can be hit and role checks work.

### Milestone B — Device & Plant Management (Module 3)
Deliverables:
- `Plant` + `Device` models
- CRUD endpoints for admin

Tasks:
1) Implement `Plant` model + admin routes
2) Implement `Device` model + install/uninstall flow
3) Add list/search endpoints (by status, plant)

Done when:
- Admin can register a plant, add a device, assign device to plant.

### Milestone C — IoT Data Acquisition (Module 1)
Deliverables:
- MQTT ingestion + telemetry storage
- mTLS device authentication via MQTT
- Availability signals (heartbeat + LWT)

Tasks:
1) Choose MQTT broker runtime for dev/staging (e.g., Mosquitto/EMQX) and define connection settings
2) Define MQTT topic naming + payload schema + `schemaVersion`
3) Implement `TelemetryReading` model
4) Implement MQTT consumer in backend (subscribe to telemetry + health)
5) Enforce mTLS requirements (cert validation, deviceId mapping)
  - Map `deviceId` from certificate CN (authoritative)
  - Reject connections/messages that do not match expected CN/device registry
6) Add device health fields + lastSeen update
7) Implement availability rules:
  - Device is considered available if last heartbeat is within a small grace window (based on 2-minute heartbeats)
  - Mark unavailable immediately on LWT unexpected disconnect event
8) Retained message strategy:
  - Publish/retain latest "Online" status and latest computed water metrics for quick dashboard initialization

Done when:
- Publishing a sample MQTT telemetry payload stores readings and updates device lastSeen.
- Simulating a disconnect triggers LWT and marks the device unavailable.

### Milestone D — Water Quality Analysis (Module 2)
Deliverables:
- Threshold config + state derivation

Tasks:
1) Implement `ThresholdConfig` model + admin config endpoints
2) Write evaluation function (Safe/Warning/Unsafe)
3) Store `WaterQualityState` per plant/device
4) Add state endpoints for UI to consume

Done when:
- Latest plant status updates correctly after telemetry arrives.

### Milestone E — Alert & Notification (Module 9)
Deliverables:
- Alerts created on threshold crossings, device offline, low inventory

Tasks:
1) Implement `Alert` model
2) Generate alerts on quality state transitions
3) Add ack/resolve flows
4) (Optional MVP) in-app notifications list; external channels later

Done when:
- Admin sees alerts created by ingestion + analysis events.

### Milestone F — Maintenance & Task Management (Module 5)
Deliverables:
- Task lifecycle: ASSIGNED → IN_PROGRESS → RESOLVED
- Logs + resolution time tracking
- Reassignment policy: supervisor-approved “Soft Handoff” while preserving accountability
- Materials tracking integrated with Inventory (MongoDB)

Tasks:
1) Implement `MaintenanceTask` + `MaintenanceLog`
2) Admin task create/assign/reassign
3) Maintainer task list + start (IN_PROGRESS)
4) Logs + resolve endpoint (sets `resolvedAt`)
5) Compute resolution time (store minutes or compute in query)
6) Implement reassignment rules for tasks already IN_PROGRESS:
  - Mandatory status update by current technician (progress + used materials)
  - Supervisor approval triggers reassignment (Soft Handoff)
  - Create an immutable handoff log entry for traceability
7) Add materials array to maintenance log submissions (stored on the task document as a history array, or stored on each log entry)
8) Decrement inventory stock only when the maintenance work is finalized (e.g., on resolve / final submission), treating materials as a single transaction
   - Use MongoDB atomic transactions (sessions) to ensure consistency
   - Avoid decrementing during draft edits to prevent double-counting/orphan entries

Done when:
- A maintainer can complete a task with logs; admin can review history.

### Milestone G — Inventory Management (Module 4)
Deliverables:
- Inventory categories + low-stock alerts

Tasks:
1) Implement `InventoryItem` model + admin CRUD
2) Implement low-stock threshold checks
3) Generate alerts when below threshold

Done when:
- Inventory list works and low-stock creates alerts.

### Milestone H — Admin Dashboard (Module 6)
Deliverables:
- Web UI that consumes: plants/devices, status, alerts, inventory, maintenance

Tasks:
1) Pages: overview (status), devices/plants, alerts, inventory, maintenance
2) Threshold configuration UI
3) Role-based navigation

Done when:
- Admin can perform core operational tasks end-to-end.

### Milestone I — Maintainer Interface (Module 7)
Deliverables:
- Task queue, task detail, logs, status updates

Tasks:
1) Tasks list (mine) + filters (status)
2) Task detail shows device/plant + recent readings
3) Log entry form + resolve flow

Done when:
- Maintainer can complete assigned work from the UI.

### Milestone J — Public User App (Module 8)
Deliverables:
- Nearby plants + status + issue reporting

Tasks:
1) Public plants list/nearby query
2) Plant detail with current water quality category + availability
3) Issue report form

Done when:
- Public can see status and submit reports.

### Milestone K — Reporting & Visualization (Module 10)
Deliverables:
- Trends + performance metrics + uptime summaries

Tasks:
1) Define KPIs: unsafe frequency, downtime, mean time to resolve (MTTR)
2) Implement report endpoints
3) Add charting in admin dashboard

Done when:
- Admin can view historical trends and maintainer performance.

### Milestone L — Blockchain-based Authentication (Module 11) (Deferred)
Goal:
- Add blockchain value without sacrificing UX.

Options:
- Step-up auth: require wallet signature only for sensitive admin operations
- Tamper-evident audit: anchor daily hashes of audit logs on-chain
- Device identity: device-signed payloads with keys registered on-chain

Done when:
- One blockchain feature improves security/integrity without complicating normal login.

---

## 6) Vertical Slice (Recommended First “Demo-able” Release)

Target: demonstrate real monitoring + human ops loop.

1) Plants + devices registered (Milestone B)
2) Telemetry ingestion stores readings (Milestone C)
3) Analysis assigns Safe/Warning/Unsafe (Milestone D)
4) Alerts generate on unsafe (Milestone E)
5) Admin assigns maintenance task from alert (Milestone F)
6) Maintainer resolves + logs (Milestone F/I)
7) Admin dashboard shows current status + task history (Milestone H)

---

## 7) Non-Functional Requirements (MVP Checklist)
- Security: device ingestion auth; RBAC for all admin/maintainer endpoints
- Data integrity: server-side validation for telemetry
- Performance: index telemetry by device/time; avoid heavy queries on hot paths
- Observability: basic logs + error monitoring hooks
- Backups: DB backup strategy (even manual for MVP)

---

## 8) Locked Decisions (Confirmed)
1) IoT transport: MQTT
2) Device authentication: mTLS with MQTT
3) Availability definition: secure MQTT transport with mTLS, plus MQTT Last Will and Testament (LWT) to flag devices unavailable on unexpected disconnects, combined with scheduled 2-minute heartbeats to track availability continuously.
4) Reassignment for tasks once IN_PROGRESS: mandatory progress + used materials log by the current technician, then supervisor approval triggers a “Soft Handoff” reassignment to the new technician to preserve accountability and continuity.

Additional locked choices:
5) MQTT broker: EMQX Serverless (free-tier for MVP)
6) mTLS certificate lifecycle: unique device certs signed by EMQX private Root CA; flashed to encrypted storage during production; OTA pushes replacement certs before expiry.
7) Device identity mapping: `deviceId` extracted from certificate CN and enforced server-side.
8) Retained messages + offline tolerance: retain latest metrics and "Online" status; offline grace window 5–6 minutes (≈ 3 missed heartbeats).
9) RBAC roles: add `SUPER_ADMIN` role to separate developers/operators from the government entity (`ADMIN`).
10) Inventory integration: store an array of material objects on maintenance updates and use MongoDB transactions to decrement stock accurately.

Finalized operational choices:
11) Device revocation/disable for MVP: manual device disable in DB (no CRL/kill-switch initially)
12) Retained payload ownership: backend publishes retained "latest metrics" after validation (source of truth)
13) Inventory decrement timing: decrement stock only upon final/complete maintenance submission (single transaction), not during drafts/edits
14) Disabled device telemetry handling: continue ingesting telemetry but mark readings as coming from a disabled device for audit/history and troubleshooting
15) Inventory decrement trigger: decrement inventory on `POST /api/maintenance/tasks/:id/resolve` within a single MongoDB transaction
16) Disabled telemetry visibility: hide disabled-device telemetry by default in dashboards/reports, but keep it accessible for audit/troubleshooting (SUPER_ADMIN/ADMIN)

## 9) Optional Questions (If you want to tighten scope further)
No further open questions at this stage.

---

## 10) Next Action (If we start coding now)

Start with Milestone B (Plants/Devices) + Milestone C (Telemetry ingestion), because every other module depends on having installations and readings.
