# Sentinel — Handoff Plan

> **The North Star**
> A site operator opens Sentinel at the start of their shift, sees a clear briefing of
> what happened overnight, approves it before handoff, and trusts every word of it.
>
> Everything in this plan exists to make that moment real.

---

## Naming

- **Sentinel** is the platform — the product operators log into each morning.
- **Argus** is the AI agent inside Sentinel — the always-watching investigator
  named after the hundred-eyed watchman of myth. Argus correlates events,
  classifies incidents, and drafts the morning briefing for the operator to review.
- **Night Watch** is the design language — the dark, instrument-panel aesthetic
  that runs through the UI.

When writing UI copy, audit messages, or documentation, use these names directly:
*"Argus flagged three incidents overnight"* — not *"the agent flagged…"*

---

## Where We Are Today

Based on a full codebase audit and review of running screenshots:

**The skeleton is built** — auth, RBAC, orgs, multi-tenant scoping, event ingestion,
incident creation, Argus, the Claude ReAct agent, the briefing model, the map, the setup
wizard, role-based admin panel — all of these exist and work.

**The wiring is incomplete** — features ship but do not talk to each other. RAG is
not connected to investigation. MCP is not mounted. The webhook worker is missing.
Documents need approval but nobody knows. The briefing page is stuck at 0%
when no investigation runs.

**The user experience is fractured** — settings uses light Tailwind, the rest is
dark Night Watch. Overview shows hardcoded "Your site" instead
of the real org. Nothing tells the user where they are in the morning workflow.

**The story is missing** — there is no welcome, no docs accessible without login,
no narrative that says *"this is what Sentinel does and how to use it."*

This plan fixes all of that, in priority order.

---

## Plan Structure

The plan is organised into five waves. Each wave is shippable on its own.
Each wave moves the platform one step closer to the morning briefing moment.

```
WAVE 1 — Make the Loop Work          (core agentic flow, end to end)
WAVE 2 — Make the Loop Visible       (UX clarity, navigation, states)  
WAVE 3 — Make the Loop Connected     (RAG, MCP, webhooks all wired)
WAVE 4 — Make the Loop Documented    (public docs, in-app help)
WAVE 5 — Make the Loop Production    (hardening, testing, observability)
```

---

# WAVE 1 — Make the Loop Work

**Goal:** A user can register → set up → trigger an investigation → see a briefing →
approve it. Every step works without errors.

## 1.1 Webhook worker (server)

The webhooks queue has no worker. Briefing approvals fire jobs that stall forever.

Create `server/src/queues/webhook.worker.js`:
- New BullMQ worker on the 'webhooks' queue
- Concurrency 3, 10s HTTP timeout per delivery
- HMAC-SHA256 signature header: `X-Sentinel-Signature: sha256=<hash>`
- Updates `WebhookDelivery` status: delivered / failed
- Logs `[WebhookWorker]` with orgId, eventType, deliveryId, status
- Graceful shutdown integrated with existing worker lifecycle

## 1.2 Briefing page state machine (client)

Currently the briefing page shows "0% complete" when nothing is running.

Fix `client/src/app/briefing/page.jsx` to handle four states:
- **No data** → empty state with link to /investigate
- **Investigation running** → progress with real percentage
- **Briefing draft ready** → render document with approve button
- **Briefing approved** → render read-only with approval timestamp

State detection order:
1. Check investigation store for active jobId
2. Call `GET /api/v1/briefings/latest`
3. Pick state based on what's present and its status

## 1.3 Overview page connection (client)

Currently shows hardcoded "Your site" and dead stat cards.

Fix `client/src/app/overview/page.jsx`:
- Fetch org via React Query, render real `org.config.siteName`
- Time-aware greeting (morning / afternoon / evening)
- Make INCIDENTS card clickable → /investigate
- Make BRIEFING card clickable → /briefing
- Show briefing status semantically: NONE (gray) / READY (accent) / APPROVED (harmless)
- If incidents exist, show severity breakdown below count

## 1.4 Auto-detect investigation completion

The investigate page already streams agent activity via SSE. But once it
completes, the user does not know to go to /briefing.

In Argus's stream handler, when status transitions to 'complete':
- Show a notification banner with "View briefing →" link
- Update the BRIEFING tab in TopBar with a notification dot
- The dot is already specified in earlier prompts — confirm it polls
  `/briefings/latest` every 30s and shows when status === 'draft'

---

# WAVE 2 — Make the Loop Visible

**Goal:** Every page tells the user where they are in the workflow,
what they did last, and what they should do next.

## 2.1 Settings migration to Night Watch theme

Settings layout currently uses Tailwind light (bg-gray-50, bg-slate-900).
The operator feels like they left the app.

Rewrite `client/src/app/settings/layout.jsx` using only Night Watch CSS tokens:
- Sidebar: `var(--bg-surface-1)` with `var(--border-default)` right border
- Active nav: `var(--bg-surface-3)` background, `var(--accent)` 2px left border
- Content area: `var(--bg-base)` background
- All typography uses `var(--font-sans)` and `var(--font-mono)` for labels

Apply same treatment to each settings page that has light-mode styling:
- /settings/general
- /settings/api-keys
- /settings/members
- /settings/documents
- /settings/webhooks
- /settings/integrations

Admin layout (super_admin only) can keep Tailwind for now — lower priority.

## 2.2 TopBar enhancement

Current TopBar shows: SENTINEL, INVESTIGATE, BRIEFING, OVERVIEW, DOCS, user.

Improvements:
- Add SETTINGS link (visible only to org_admin and super_admin)
- User avatar opens a dropdown with: Profile, Settings, Admin Panel (if role allows), Sign out
- Add notification dot on BRIEFING when a draft briefing exists
- Order of primary nav: OVERVIEW, INVESTIGATE, BRIEFING (matches workflow chronology)

## 2.3 Page header consistency

Every authenticated page should have a small breadcrumb-style header showing:
- Current section (uppercase, mono, small)
- Org name + site name
- Critical state if applicable ("INVESTIGATING…" or "BRIEFING READY")

Already present on investigate and overview — extend to settings pages
and incident detail.

## 2.4 Empty states everywhere

Every page that can be empty must have a proper empty state, not a blank screen:
- Investigate with no events → "No overnight events for {date}. Patrol either
  did not run or did not detect anything reportable."
- Briefing with no investigation → covered in Wave 1.2
- Settings/documents with no docs → "Upload your site procedures, contractor
  schedules, and safety manuals. Claude uses them during investigations."
- Settings/webhooks with no deliveries → "No webhook deliveries yet."
- Settings/members with only the admin → "Invite your team to share the
  morning briefing workflow."

Empty states use `var(--fg-3)` color, centered, with one clear next action.

---

# WAVE 3 — Make the Loop Connected

**Goal:** Every feature that exists actually contributes to the briefing.
Nothing is built that the user cannot find or that does not connect.

## 3.1 MCP router mount + tool logging (server)

Per latest grep, mcpRouter IS mounted in app.js — but the audit listed it as
missing because of a stale check. Confirm by:
- Curl `http://localhost:8000/api/v1/mcp` with no auth → expect 401
- Curl with valid API key (mcp scope) → expect SSE connection

Add per-call audit logging in `mcp.routes.js`:
- For every JSON-RPC `tools/call` method, write an AuditLog entry
- Action: 'mcp.tool_call'
- Metadata: { toolName, orgId, durationMs, success, errorCode }

## 3.2 MCP integrations page becomes useful

`/settings/integrations` currently shows MCP activity but no explanation.

Enhancements:
- Top section: "Connect your AI agent" with the endpoint URL + copy button
- Step-by-step: create API key with mcp scope → endpoint → list of 8 tools
- Below: the existing activity log (now showing real data thanks to 3.1)
- Each tool listed with one-line description of what it returns

## 3.3 RAG pipeline (if not yet implemented)

Per audit, Phase 10 (RAG) is 0/8. If still missing, build:
- `RagDocument` model with: orgId, filename, status (pending/indexing/indexed/failed),
  chunkCount, vectorIds[], uploadedBy, approvedBy, approvedAt, errorMessage
- `server/src/services/rag.service.js` with indexDocument() and queryRag()
- Qdrant client in docker-compose (already present?) — verify
- `rag-indexing` BullMQ queue + worker
- queryRag called in agent.js Phase 1 before Claude reasoning starts
- Vectors namespaced by orgId for tenant isolation

## 3.4 RAG approval flow — remove org_admin friction

When an org_admin uploads a document, auto-approve it.
Only operator uploads require explicit approval.

In `org.controller.js` uploadDocument:
- If req.user.role in ['org_admin', 'super_admin']: set status to 'approved',
  approvedBy = req.user._id, approvedAt = now, enqueue rag-indexing job immediately
- Else: leave status as 'pending_review'

## 3.5 RAG visibility — close the feedback loop

Document upload feels valuable only if the user sees it being used.

In `/settings/documents`, add status badge per row:
- PENDING APPROVAL (amber)
- INDEXING (blue pulse)
- ACTIVE · X chunks (green)
- FAILED (red, with tooltip showing errorMessage)

In incident detail and briefing, add a "Sources" line:
- "Claude referenced: Site Safety Manual · Patrol Procedures"
- Use `var(--fg-3)`, `var(--font-mono)`, `var(--text-xs)`
- Only render if `investigation.ragDocumentsQueried` is non-empty

Backend: ensure `agent.js` saves `ragDocumentsQueried = ragResults.map(r => r.filename)`
on the Investigation document after the RAG query phase.

## 3.6 Webhook settings — explain the value

`/settings/webhooks` shows configuration but does not explain when fires.

Add a reference section visible by default (not collapsed):
- Event types fired: incident.created, incident.classified,
  investigation.completed, briefing.approved
- Use case: shift management system notification, Slack post, downstream automation
- Signature verification snippet (Node.js example) for receivers

---

# WAVE 4 — Make the Loop Documented

**Goal:** Anyone can understand what Sentinel does without an account.
New users have a clear onboarding path. Existing users can find help.

## 4.1 Public /docs route

Move documentation outside the auth boundary so evaluators and invitees
can read it before signing in.

In `client/src/middleware.js`: add '/docs' to PUBLIC_PATHS.
In `client/src/components/layout/RootFrame.jsx`: add '/docs' to PUBLIC_ROUTES set.

Create `client/src/app/docs/page.jsx`:
- Standalone page, no TopBar, no app shell, full Night Watch theme
- Left sidebar (220px, fixed) with anchor nav
- Right content (scrollable) with 8 sections

Sections (use Template B from CLAUDE.md §4):
1. What is Sentinel?
2. How it works — the overnight cycle (visual diagram)
3. Getting started — registration through first briefing
4. Connecting your drones — API endpoint, payload schema, curl example
5. Understanding incidents — severity, status lifecycle
6. Morning briefing — sections, approval, distribution
7. Security & encryption — plain language summary of CLAUDE.md §7
8. MCP integration — what it is, 8 tools, connection snippet

Sidebar bottom: "Sign in →" and "Get started →" buttons.

## 4.2 Landing page connection

Update `client/src/app/page.js` (the public landing) to link to /docs prominently:
- Hero CTA pair: "Sign in" + "Read the docs"
- Footer link: "Documentation"

## 4.3 In-app help links

Every settings page and the overview page should have a small "?" or "Learn more"
link that scrolls /docs to the relevant anchor:
- /settings/api-keys → /docs#connecting-drones
- /settings/webhooks → /docs#webhooks (add this section)
- /settings/integrations → /docs#mcp
- /overview → /docs#how-it-works

## 4.4 First-run setup wizard polish

The setup wizard already exists and is wired. Verify Wave 1–3 changes
do not break it. Specifically:
- Step 4 (Ready) finish button should redirect to /overview, not /investigate
  (overview is the new morning landing page)
- The wizard remains the only mandatory pre-app onboarding

---

# WAVE 5 — Make the Loop Production

**Goal:** The platform can be deployed safely, observed in production,
and verified by automated tests.

## 5.1 Agentic flow test suite

Create `server/src/tests/agentic-flow.test.js` using `bun:test`:

```
Group 1 — Event ingestion (3 tests)
Group 2 — Incident creation (1 test)
Group 3 — Investigation lifecycle (3 tests)
Group 4 — Briefing generation & approval (2 tests)
Group 5 — RAG pipeline (2 tests)
Group 6 — Webhook delivery (2 tests, mocked receiver)
```

Use a separate test database (MONGODB_TEST_URL). Tear down all created
data in afterAll. Add `bun run test:agentic` script in package.json.

## 5.2 Production hardening (per AUDIT.md)

Install and configure missing security middleware:
- `helmet()` in app.js
- `express-mongo-sanitize()` in app.js
- Both already noted in current app.js — verify they are actually wired

Logging:
- Replace remaining `console.log` with structured logger (pino)
- Format: `logger.info({ orgId, action, durationMs }, 'message')`

Observability:
- Add `@sentry/node` server-side (already imported in app.js per grep)
- Add `@sentry/nextjs` client-side
- Configure SENTRY_DSN env var

## 5.3 Connection encryption (per CLAUDE.md §7)

Production deployment must:
- MongoDB URL with `tls=true`
- Redis URL with `rediss://` scheme
- Nginx reverse proxy with SSL termination (add to docker-compose.prod.yml)

Add a deployment checklist file `DEPLOY.md` documenting these settings.

## 5.4 Migration script

`server/src/scripts/migrate-orgId.js`:
- Find all documents missing orgId across event/incident/investigation/briefing/review
- For each: infer orgId from related document (e.g. incident.orgId from event.orgId)
- If inference fails, log and skip (don't guess)
- Idempotent — safe to run multiple times

## 5.5 Webhook signing verification

The HMAC-SHA256 signature is generated by Wave 1.1's worker.
Document the verification side for webhook receivers:
- Add example Node.js verification snippet to /docs#webhooks
- Add example Python verification snippet
- Confirm signature uses raw JSON body (not parsed)

---

# Suggested Execution Order

If you can ship one wave at a time, this is the order:

| Wave | Why it goes first | User-visible after |
|---|---|---|
| 1 — Make the Loop Work | Without this, nothing else matters. The core promise is broken. | The full overnight → briefing → approve cycle is real. |
| 2 — Make the Loop Visible | Builds the trust layer. Inconsistent UX creates doubt. | App feels like one product, not stitched parts. |
| 3 — Make the Loop Connected | Each existing feature finally pays for itself. | RAG, MCP, webhooks all visibly contribute to better briefings. |
| 4 — Make the Loop Documented | Onboarding stops being tribal knowledge. | New users can self-serve from /docs. |
| 5 — Make the Loop Production | Required for real customers, not for demos. | Platform is testable, observable, deployable. |

---

# Definition of Done — The Morning Briefing Test

After all 5 waves, this single scenario must work end to end without intervention:

1. New user registers via /register
2. Completes the 4-step setup wizard
3. Lands on /overview, sees "GOOD MORNING — {date}, {site name}"
4. (Overnight) Drones POST 10 events to /api/v1/events using the wizard-generated key
5. Worker correlates events into 3 incidents
6. User logs in at the start of shift, sees overview with 3 incidents flagged
7. User clicks INCIDENTS card → /investigate, sees all events on map
8. User clicks Start Investigation → Argus classifies via Claude + RAG
9. SSE stream shows Argus's tool calls live in the agent feed
10. Investigation completes, BRIEFING tab gets notification dot
11. User clicks BRIEFING → renders the draft document with 5 sections,
    each citing referenced documents from RAG
12. User reviews, clicks Approve
13. Webhook fires to configured URL with HMAC signature
14. Audit log records: org.setup.complete, investigation.start, agent.tool_call (each),
    briefing.approved, webhook.delivered
15. /settings/integrations shows MCP activity from any external agent calls

If any step fails or feels disconnected, the loop is not done.

---

# Final Note

Every change in this plan must respect the rules in CLAUDE.md:
- Night Watch tokens, no hardcoded colors
- API responses already unwrapped — never double `.data`
- `router.replace` not `router.push` after auth transitions
- async callbacks where await is used
- super_admin exempt from setup gate
- super_admin firstLogin → false on completeSetup

Read CLAUDE.md before each wave. Update it after each wave with new patterns,
new bugs found, new conventions established.

The goal is never the code. The goal is the operator at the start of shift who
trusts what they're reading.

---

*Plan version 1.0 — 2026-05-14*
*Maintainer: Sentinel development team*

---

# Completed Work

## Rebrand pass — Ridgeway → Sentinel, "the agent" → Argus (2026-05-15)

Global user-facing rename. **Code-internal identifiers preserved** (localStorage/cookie keys,
DB names, Qdrant collection `ridgeway_documents`, repo path, npm import paths, internal class
names, Claude SDK calls). Audit-log action strings explicitly preserved with a stable-identifier
comment in `server/src/utils/audit.js` — renaming would break historical filtering on existing
DB records.

**Client (user-facing surfaces):**
- `client/src/app/layout.js` — browser tab title + description → Sentinel
- `client/src/components/layout/TopBar.jsx` — logo "RIDGEWAY" → "SENTINEL"
- Auth/landing pages: login, register, page.js (landing), opt, profile, invite/accept, setup,
  suspended, forbidden — all visible "Ridgeway Site" / "Ridgeway" → "Sentinel"
- `client/src/app/admin/layout.jsx` — sidebar label → Sentinel
- `client/src/app/investigate/page.js` — "Agent Activity" → "Argus Activity";
  welcome banner; "RIDGEWAY · 6 ZONES" → "SENTINEL · 6 ZONES"
- `client/src/app/briefing/page.js` — state 2 "Agent is completing the investigation" →
  "Argus is completing the investigation"; "Agent has drafted the briefing" → "Argus has drafted..."
- `client/src/components/briefing/BriefingDocument.jsx` — print head title → Sentinel
- `client/src/components/briefing/BriefingSection.jsx` — "Agent draft" → "Argus draft"
- `client/src/components/agent/AgentFeed.jsx` — "Agent is gathering context" → "Argus..."
- `client/src/components/incident/ReviewReadOnlyState.jsx` — "agreed with the agent's…" → "Argus's…"
- `client/src/components/shared/Footer.js`, `Navbar.js` — "Ridgeway OIP" → "Sentinel"
- Settings: general, integrations, webhooks, api-keys — body copy, placeholders (`/webhooks/ridgeway`
  → `/webhooks/sentinel`), MCP config key `"ridgeway"` → `"sentinel"`, X-Ridgeway-* header references
  → X-Sentinel-*
- `client/src/app/docs/page.jsx` — sidebar label, all body prose, MCP snippet host
  (`your-ridgeway-host` → `your-sentinel-host`), function names
  `verifyRidgewaySignature` → `verifySentinelSignature`, header refs → X-Sentinel-Signature
- `client/package.json` name → `sentinel-client`

**Server (user-facing surfaces):**
- `server/src/utils/mail.js` — product name default, all email body intros/outros, test subject
- `server/src/controllers/auth.controllers.js` — (cookie name kept; internal)
- `server/src/controllers/admin.controller.js`, `org.controller.js` — invite subjects → "invited to Sentinel"
- `server/src/controllers/org.controller.js` — webhook test message; test delivery headers X-Sentinel-*
- `server/src/controllers/email.controller.example.js` — all subjects/copy → Sentinel
- `server/src/queues/worker.js` — outbound webhook headers `X-Ridgeway-{Event,Delivery,Signature}`
  → `X-Sentinel-{Event,Delivery,Signature}`
- `server/src/services/briefing.service.js` — fallback follow-up gap message uses "Argus"
- `server/.env.example` — APP_NAME, EMAIL_FROM_NAME → Sentinel
- `server/package.json` name → `sentinel-server`
- `server/src/utils/audit.js` — added stability comment near `logAudit`

**Docs:**
- `README.md` — title and overview text → Sentinel (with Argus note)

**Preserved as-is (intentional):**
- localStorage keys `ridgeway_token`, `ridgeway_refresh_token`, `ridgeway_user`, cookies
  `ridgeway_auth`, `ridgeway_role`, `ridgeway_setup`, `ridgeway_welcome_dismissed` —
  renaming would log out every existing user
- Qdrant collection `ridgeway_documents`, Mongo DB name `ridgeway` — data identifiers
- Repo directory `RidgewaySite`, internal import paths, server class names
- `support@ridgeway.io`, `admin@ridgeway.com`, `noreply@ridgeway-site.com`,
  placeholder `operator@ridgeway.site` — actual external infrastructure / domain references
- `AUDIT.md`, `CLAUDE.md` history files
- AuditLog action strings — see comment in `server/src/utils/audit.js`

**Verification still required (run app + manual checks):**
- Login page shows SENTINEL ✓ (code)
- TopBar shows SENTINEL ✓ (code)
- Investigate page agent panel says ARGUS ACTIVITY ✓ (code)
- Briefing in-progress screen says "Argus is completing the investigation" ✓ (code)
- Browser tab title shows Sentinel ✓ (code, metadata.title)
- Outbound webhook against webhook.site carries `X-Sentinel-Signature` ✓ (code in worker.js / org.controller.js test path) — run a real delivery to confirm
