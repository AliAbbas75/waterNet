# WaterNet — Team Progress Tracking

This folder contains lightweight, per-member progress trackers that map directly to the milestones in [plan.md](../plan.md).

## How to use (low coordination)

### Weekly async update (recommended)
- Each member updates only their own file once per week (or when a milestone is completed).
- Keep updates short: 3 bullets (done / next / blocked).

### PR + issue hygiene (minimal overhead)
- One PR per milestone slice (or per endpoint group) is ideal.
- Use simple branch names: `milestone-C-mqtt-ingestion`, `milestone-D-analysis`, etc.
- Reference the milestone and owner file in the PR description.

### Definition of Done (DoD) for each checklist item
- Code merged to main branch
- Basic happy-path tested (manual or scripted)
- Any required env/config documented
- API contract stable enough for the UI consumers

## Suggested collaboration methods (low effort, high payoff)

1) Single source of truth
- Keep architecture + milestone sequencing in [plan.md](../plan.md).
- Avoid duplicating specs in chat; instead, append short “Decisions” notes to the relevant tracker.

2) Small, explicit API contracts
- Before building UI, agree on request/response JSON for the needed endpoints.
- Record the contract in the owner tracker under “API contracts”.

3) Dependency handshake
- When a milestone depends on another team member:
  - Agree on a minimal stub first (return mocked data but stable shape), then iterate.

4) Keep reviews fast
- Prefer PRs that are reviewable in <30 minutes.
- If a PR gets too large, split by: model → controller → routes → UI.

## Files
- [Ali Abbas](ali-abbas.md)
- [Farrukh Khan](farrukh-khan.md)
- [Asmara Kanwal](asmara-kanwal.md)
- [Team Board](team-board.md)
