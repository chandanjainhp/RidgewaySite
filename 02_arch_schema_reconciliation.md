# Phase 2 — Schema reconciliation

**Goal.** Eliminate drift between docs, models, tools, and frontend. Pick one vocabulary per concept and propagate end-to-end.

**Read first:** `CLAUDE.md`, `AUDIT.md`, `server/src/models/*.js`, `server/src/ai/tools-registry.js`, `client/src/config/constants.js`, this prompt.

**Ground truth rule.** The current Mongoose models are ground truth for *shape*. The canonical decisions below are ground truth for *vocabulary*. Migrate code to match the canonical decisions, not the other way around.

---

## Canonical decisions (do not re-litigate)

### Severity
`serious | minor | harmless | uncertain`

Migration map from current legacy field names:
- `escalate → serious`
- `monitor → minor`
- `harmless → harmless`
- `uncertain → uncertain`
- `unknown → uncertain`

Applies to: `Event.severity`, `Incident.severity`, `Incident.finalSeverity` (field is renamed to `Incident.severity` — see below), `Investigation.finalClassification.severity`, all tool inputs, all client renderings.

### Incident lifecycle
`open | investigating | reviewed | escalated | closed`

Migration map:
- `pending → open`
- `investigating → investigating`
- `complete → reviewed`
- `needs_followup → escalated`

### Investigation lifecycle
`queued | running | complete | failed`

Migration map:
- `pending → queued`
- existing `running/complete/failed` unchanged

### Briefing lifecycle
`generating | draft | approved | failed`

Add `generating` (auto-set when briefing record created, before content is filled) and `failed` (set if generation crashes).

### Event types
`motion_detected | badge_swipe_fail | vehicle_entry | fence_alert | environmental`

Migration: any event currently typed `badge_swipe`, `gate_open`, etc. → enumerate exhaustively in the migration script. Read current `Event.type` distinct values from prod-shape data before writing the map.

### Field renames

| Old (in code) | New (canonical) |
|---|---|
| `Incident.finalSeverity` | `Incident.severity` (drop `severity` legacy field; keep only one) |
| `Investigation.finalClassification` | `Investigation.classification` |
| `Incident.primaryLocation` | `Incident.location` |
| `Incident.correlationType` | `Incident.correlation.type` (nested under existing `correlation` object) |
| `Incident.raghavsNote` | **delete the field entirely** (legacy marker; no semantic value) |
| `Briefing.sections` (current shape: `{ executive_summary: { agentDraft, mayaVersion, isEdited } }`) | flatten to array of `{ name, content, lastEditedAt }` per README |

### Dates
- `nightDate` is a **string** `YYYY-MM-DD` (per README), not a `Date`. Migrate `Event.nightDate`, `Incident.nightDate`, `Briefing.nightDate` from `Date` to `String`. Index unchanged.
- `Date` types remain for `timestamp`, `createdAt`, `updatedAt`, `detectedAt`, `approvedAt`, etc.

### Tool roster (Argus)
Six tools per README + system prompt:
1. `accessControl`
2. `droneSimulator`
3. `environmentalSensor`
4. `logs`
5. `map`
6. `vehicleRegistry`

Plus two **output** tools (model produces structured output via these — they are not "data lookups"):
- `submit_classification` (replaces `classify_incident`)
- `draft_briefing_section`

Rename `query_vehicle_registry → vehicleRegistry`, `query_environmental_data → environmentalSensor`, etc. The system prompt currently references the old names; update it.

---

## Deliverables (ship in order)

### 2A — Write the migration script (1 day)

`server/src/scripts/migrate-canonical-schema.js`

- Connect to MongoDB via `MONGODB_URL`
- For each collection (`events`, `incidents`, `investigations`, `briefings`):
  - **Dry-run mode by default.** Counts and per-document diffs to stdout. No writes.
  - `--apply` flag performs the writes.
- Idempotent: re-running on already-migrated data is a no-op.
- Wrap each collection migration in a transaction if Mongo is a replica set; otherwise batch updates of 500 and log progress.
- Migration steps per collection:

**events**
- `nightDate`: `Date → String` (`YYYY-MM-DD`). Use UTC date of the existing Date value.
- `severity`: legacy enum → canonical enum (map above).
- `type`: read distinct values, map any non-canonical to the closest canonical type, log unmapped values and abort if any.

**incidents**
- Rename `finalSeverity → severity` (drop old `severity` field).
- Rename `primaryLocation → location`.
- Move `correlationType` value into `correlation.type` (preserve existing `correlation.strategy` and `correlation.metadata` if present).
- Delete `raghavsNote`.
- Migrate `status` enum.
- Migrate `severity` enum.
- `nightDate`: `Date → String`.

**investigations**
- Rename `finalClassification → classification`.
- Migrate `classification.severity` enum.
- Migrate `status` enum.

**briefings**
- Convert `sections` object → array. Each existing key becomes one array entry: `{ name: <key>, content: <agentDraft || mayaVersion || ''>, lastEditedAt: <updatedAt || null> }`.
- Migrate `status` enum (existing `draft/approved` unchanged, but add nothing yet — `generating/failed` are forward states, not back-migration).
- `nightDate`: `Date → String`.

### 2B — Update Mongoose schemas (1 day)

`server/src/models/event.model.js`, `incident.model.js`, `investigation.model.js`, `briefing.model.js`:
- Update enums to canonical values.
- Rename fields per the table above.
- Change `nightDate` type to `String` with regex match `/^\d{4}-\d{2}-\d{2}$/`.
- Drop deleted fields entirely.
- Update indexes if affected.

**Hard constraint:** if any old field name appears anywhere in the codebase after this change, the build must fail. Add an ESLint rule (or grep check in CI) for the deprecated names: `finalSeverity`, `finalClassification`, `primaryLocation`, `correlationType`, `raghavsNote`.

### 2C — Update server-side consumers (2 days)

Files to touch:
- `server/src/controllers/incident.controller.js` — remove all `incident.finalSeverity || incident.severity` defensive reads; trust the canonical field.
- `server/src/controllers/investigation.controller.js` — same for `finalClassification`.
- `server/src/services/briefing.service.js` — rewrite the section builder for the new array shape; eliminate the `severityBuckets.escalate/monitor` references; switch to canonical names.
- `server/src/services/correlation.service.js` — set canonical status/severity at creation.
- `server/src/ai/prompts/system.js` — rewrite the CLASSIFICATION FRAMEWORK block and tool names. Update output instructions: `submit_classification` with `severity` enum from canonical set.
- `server/src/ai/tools-registry.js` — update tool names and input/output schemas to match.
- `server/src/ai/agent.js` — update tool dispatch to canonical names.
- `server/src/mcp/server.js` — update `list_incidents` severity filter to accept canonical values; keep a one-release backward-compat shim that maps legacy values in input only (log a deprecation warning on each use).
- `server/src/scripts/seedTestData.js` and `db/seed.js` — use canonical values throughout.
- All `validators/*.js` files — update Zod/express-validator schemas.

### 2D — Update client consumers (2 days)

- `client/src/config/constants.js` — `SEVERITY_CONFIG` keyed by canonical names. Single export from `client/src/lib/severity.js`:
  ```js
  export const SEV_TOKENS = {
    serious:   { token: 'var(--sev-serious)',  icon: AlertTriangle, label: 'Serious' },
    minor:     { token: 'var(--sev-minor)',    icon: Circle,        label: 'Minor' },
    harmless:  { token: 'var(--sev-harmless)', icon: CheckCircle,   label: 'Harmless' },
    uncertain: { token: 'var(--sev-unknown)',  icon: HelpCircle,    label: 'Uncertain' },
  }
  ```
- Every component that derives severity colour must import from this module. Delete every local `SEV_STYLE`, `SEV_TOKENS`, `SEVERITY_*` constant in components.
- Pages to update: `app/overview/page.jsx`, `app/incidents/page.jsx`, `app/incident/[id]/page.js`, `app/briefing/page.jsx`, `app/investigate/page.js`, `components/events/SeverityBadge.jsx`, `components/events/EventCard.jsx`, `components/briefing/*`.
- Replace all field reads:
  - `incident.finalSeverity || incident.severity` → `incident.severity`
  - `incident.primaryLocation || incident.location` → `incident.location`
  - `investigation.finalClassification` → `investigation.classification`
  - Defensive `|| 'unknown'` fallbacks become `|| 'uncertain'`.

### 2E — Regenerate docs (half day)

- `CLAUDE.md` §5 Data Models — rewrite to match the new schema exactly. Keep a `## Migration history` appendix noting that pre-2026-05-XX records used legacy field names.
- `README.md` — update incident/severity/status references.
- Delete `client/DESIGN.md` (unrelated legacy doc).
- `AUDIT.md` — mark the items this phase resolves.

---

## Acceptance criteria

1. `bun run test:agentic` passes end-to-end with the new vocabulary.
2. Grep returns zero matches for `finalSeverity`, `finalClassification`, `primaryLocation`, `correlationType`, `raghavsNote`, `escalate`, `monitor` (except inside the migration script itself and the legacy → canonical compat shim in MCP).
3. `submit_classification` tool input schema enforces the canonical severity enum.
4. Seed-data run produces incidents with canonical status and severity values.
5. `/overview` and `/incidents` render the same severity colours and icons everywhere.
6. Running the migration script with `--apply` against a copy of staging data produces zero unmapped values.

---

## Constraints (do not break)

- `req.orgFilter` on every query.
- Audit action strings unchanged (`briefing.approved`, `mcp.tool_call`, etc.).
- MCP API stays backward-compatible for one release via legacy → canonical input shim with deprecation logs.
- Migration must be re-runnable.
