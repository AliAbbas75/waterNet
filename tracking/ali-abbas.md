# Progress Tracker — Ali Abbas

Owner modules:
- Water Quality Analysis Module
- Alert and Notification Module
- Inventory Management Module
- Blockchain-Based Authentication Module (deferred / optional)

Milestone mapping (see [plan.md](../plan.md)):
- Milestone D — Water Quality Analysis
- Milestone E — Alert & Notification
- Milestone G — Inventory Management
- Milestone L — Blockchain-based Authentication (Deferred)

## Status (edit as you go)
- Current focus:
- Blockers:
- Next milestone target:

## Checklist — Milestone D (Water Quality Analysis)
- [ ] Confirm threshold model requirements (global + per-plant overrides)
- [ ] Implement `ThresholdConfig` persistence + admin endpoints
- [ ] Implement evaluation function: Safe/Warning/Unsafe + reason codes
- [ ] Store/update latest `WaterQualityState` per plant/device
- [ ] Expose read endpoints for UIs (admin/maintainer/public)
- [ ] Smoke test with sample telemetry records (from Milestone C)

### API contracts (to lock early)
- `GET /api/plants/:id/state` response shape:
  - category (`SAFE|WARNING|UNSAFE|NO_DATA`)
  - reasons (parameter + value + threshold band)
  - lastEvaluatedAt

## Checklist — Milestone E (Alert & Notification)
- [ ] Define alert types + severity mapping
- [ ] Implement `Alert` persistence
- [ ] Create alerts on water quality state transitions
- [ ] Device availability alert rules (offline/unavailable events)
- [ ] Add ack/resolve actions and enforce RBAC
- [ ] Ensure alerts are queryable by plant/device and time window

### Notes
- Availability alerts should respect “disabled device telemetry” rules (still ingested, but hidden by default).

## Checklist — Milestone G (Inventory Management)
- [ ] Implement `InventoryItem` model
- [ ] Admin CRUD endpoints
- [ ] Low-stock detection rules + alert generation
- [ ] Agree on inventory decrement semantics with Maintenance module:
  - Decrement only on `POST /api/maintenance/tasks/:id/resolve`
  - Use MongoDB transactions for consistent stock updates

### Data contract (materials)
- Material object fields (suggested minimal):
  - `inventoryItemId`
  - `quantity`
  - `unit` (optional)
  - `notes` (optional)

## Checklist — Milestone L (Blockchain-based Authentication) — Deferred
Goal: add blockchain value without complicating normal login.

Pick exactly one (later):
- [ ] Step-up auth for sensitive admin actions (wallet signature)
- [ ] Tamper-evident audit anchoring (daily hash)
- [ ] Device identity anchoring (optional)

## Weekly update log
### Week of YYYY-MM-DD
- Done:
- Next:
- Blocked:
