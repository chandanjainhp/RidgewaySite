# CLAUDE.md — Sentinel
# Project context, architecture, design system, templates, and conventions for Claude Code

> **Sentinel** is the platform. **Argus** is the AI agent inside it.
> **Night Watch** is the design language.
> When writing code, audit messages, and UI copy, use these names directly.
> Read this file fully before making any change.

---

## 0. Quick Reference

| Thing | Value |
|---|---|
| Product name | Sentinel |
| AI agent name | Argus |
| Design system | Night Watch |
| Repo / dir name | RidgewaySite (historic — do not rename) |
| Client | Next.js 16 (React 19), Tailwind CSS 4, Zustand, React Query |
| Server | Express.js on Bun, MongoDB, Redis, Qdrant, BullMQ |
| AI (prod) | Anthropic Claude SDK (claude-sonnet-4-5) |
| AI (test) | LM Studio (OpenAI-compatible) — `localhost:1234/v1` |
| Auth | JWT (httpOnly cookie) + bcrypt + OTP via email |
| Runtime | Docker Compose (dev + prod) |
| Key ports | Client 3000 · Server 8000 · MongoDB 27017 · Redis 6379 · Qdrant 6333 |
| Plan doc | HANDOFF.md (the wave-by-wave build plan) |

---

## 1. What Sentinel Does — The Core Loop

This is the most important thing to understand before touching any code.

```
NIGHT (automated)
  Drones patrol industrial site
  Sensors capture: motion, badge swipes, vehicle movement, environmental
  Events arrive at POST /api/v1/events via drone API key

OVERNIGHT (automated)
  BullMQ worker correlates events into incidents
  Argus (Claude ReAct loop) investigates, classifies, generates briefing
  All results written to MongoDB scoped to the org

MORNING (operator-triggered)
  Operator logs in → /overview shows the night summary
  Operator clicks BRIEFING → reviews Argus's draft
  Operator approves → webhook fires to downstream systems
```

**Every UI decision, every route, every feature must serve this loop.**
If a feature does not help an operator understand last night faster, question it.

The single test of "done" lives in HANDOFF.md → "Definition of Done — The Morning Briefing Test."

---

## 2. Naming Rules (Strict)

| Surface | Use | Do not use |
|---|---|---|
| Product name in UI | Sentinel | Ridgeway |
| AI agent in UI copy | Argus | "the agent" · "the assistant" · "Claude" |
| Agent code/files | `agent.js`, `agentic` | (keep internal names) |
| Logs visible to users | Argus | the agent |
| Internal worker logs | "agent" is fine | — |
| Webhook headers | `X-Sentinel-*` | `X-Ridgeway-*` |
| Email templates | Sentinel | Ridgeway |
| Audit log action strings | DO NOT RENAME — stable identifiers | — |
| Git repo / folder | leave as RidgewaySite | — |

When in doubt: if a human sees it, use Sentinel/Argus. If only a developer sees it, internal names are fine.

---

## 3. Project Structure

```
RidgewaySite/
├── client/                         # Next.js 16 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── (public)/
│   │   │   │   ├── page.js         # Landing page → /login or /docs
│   │   │   │   └── docs/           # PUBLIC documentation (no auth)
│   │   │   ├── (auth)/
│   │   │   │   ├── login/          # JWT login
│   │   │   │   └── register/       # Registration → /setup
│   │   │   ├── setup/              # First-run wizard (4 steps) → finishes to /overview
│   │   │   ├── overview/           # Morning hub
│   │   │   ├── investigate/        # Argus investigation runner — 3-column layout
│   │   │   ├── briefing/           # Briefing document view (4 states — see §10)
│   │   │   ├── incident/[id]/      # Incident detail — 2-pane case file
│   │   │   ├── settings/
│   │   │   │   ├── api-keys/       # Org API keys
│   │   │   │   ├── documents/      # RAG document upload + approval
│   │   │   │   ├── general/        # Org profile
│   │   │   │   ├── integrations/   # MCP — explain + activity
│   │   │   │   ├── members/        # Invite + roles
│   │   │   │   └── webhooks/       # Webhook config + deliveries
│   │   │   └── admin/              # Super-admin panel (its own layout)
│   │   ├── components/
│   │   │   ├── shared/             # TopBar, Footer, StatusBar
│   │   │   └── ui/                 # Radix primitives wrapped in Night Watch tokens
│   │   ├── store/                  # Zustand: authStore, investigationStore, mapStore
│   │   ├── lib/
│   │   │   ├── api.js              # axios instance + interceptor (UNWRAPS ONCE)
│   │   │   └── auth.js             # Auth helpers
│   │   ├── colors_and_type.css     # DESIGN TOKENS — read before any styling
│   │   ├── middleware.js           # Auth gate + setup gate + role gate
│   │   └── app/globals.css         # Tailwind + token imports
│   └── tailwind.config.js
│
├── server/src/
│   ├── ai/
│   │   ├── agent.js                # Argus — Claude ReAct loop
│   │   ├── llm-client.js           # Abstraction: Anthropic in prod, LM Studio in test
│   │   ├── memory.js               # Redis conversation + site facts
│   │   └── tools-registry.js       # Tool definitions + dispatcher
│   ├── controllers/                # Route handlers (auth, events, incidents…)
│   ├── db/                         # MongoDB + Redis + in-memory graph
│   ├── mcp/server.js               # MCP SSE server — external agent access
│   ├── middlewares/
│   │   └── auth.middleware.js      # verifyJWT · verifyApiKey · requireRole · scopeToOrg
│   ├── models/                     # Mongoose schemas
│   ├── queues/                     # BullMQ queues + workers (incl. webhook.worker.js)
│   ├── services/                   # briefing, rag, email, webhook services
│   ├── tests/                      # bun:test — runs against LM Studio (see §9)
│   └── tools/                      # MCP tool implementations
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── AUDIT.md                        # Security & feature audit
├── HANDOFF.md                      # Wave-by-wave build plan
└── CLAUDE.md                       # ← you are here
```

---

## 4. Design System — Night Watch

**Read `client/src/colors_and_type.css` before writing any styling.**
These tokens are the law. Never hardcode hex values. Never use Tailwind colour utilities (`bg-gray-*`, `text-slate-*`) in operator-facing pages.

### Color Tokens

```css
/* Surfaces — layered by elevation, not shadow */
--bg-base:       #07090c;
--bg-surface-1:  #11151c;
--bg-surface-2:  #161b24;
--bg-surface-3:  #1c222d;

/* Borders */
--border-hairline: #1a2029;
--border-default:  #232b38;
--border-strong:   #334055;
--border-focus:    #b8d4e8;   /* radar blue — focus rings only */

/* Text — 4 ranks */
--fg-1: #e6ecf3;
--fg-2: #aab4c2;
--fg-3: #6b7686;
--fg-4: #434d5c;

/* Severity — the ONLY saturated colors in the system */
--sev-serious:    #ff3838;
--sev-minor:      #e89a2b;
--sev-harmless:   #7d8a6a;
--sev-unknown:    #6b7686;

/* Accent — radar blue, instrumentation only */
--accent:         #b8d4e8;
--accent-dim:     #5a87a8;

/* Special */
--bg-briefing:    #f4f1ea;   /* briefing document only */
```

### Typography

```css
--font-sans:  'IBM Plex Sans', system-ui, sans-serif;
--font-serif: 'IBM Plex Serif', Georgia, serif;   /* briefing document only */
--font-mono:  'JetBrains Mono', monospace;        /* timestamps, IDs, code, labels */

--text-xs:   11px;
--text-sm:   13px;
--text-base: 14px;
--text-md:   15px;
--text-lg:   17px;
--text-xl:   20px;
--text-2xl:  24px;
```

### Motion

```css
--ease-out: cubic-bezier(0.2, 0.7, 0.3, 1);
--dur-fast: 120ms;
--dur-med:  220ms;
```

### The Briefing Exception

The `/briefing` page (when rendering an actual briefing document) uses `--bg-briefing` (paper) and `--font-serif`. Every other page is dark. Do not mix.

---

## 5. Layout Templates

### Template A — Full-viewport 3-column (Investigate pattern)

```jsx
<div style={{
  position: 'fixed', top: '56px', left: 0, right: 0, bottom: 0,
  display: 'grid',
  gridTemplateColumns: '360px 1fr 360px',
  gap: '1px',
  background: 'var(--border-default)',
  overflow: 'hidden',
}}>
  <LeftPanel />    {/* scrolls internally */}
  <CentrePanel />
  <RightPanel />
</div>
```

### Template B — Settings / form page (scrollable)

```jsx
<div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '32px 24px' }}>
  <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xl)',
               fontWeight: 500, color: 'var(--fg-1)', margin: 0 }}>
    Page Title
  </h1>
  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-3)', marginTop: '4px' }}>
    Supporting description.
  </p>

  <section style={{
    background: 'var(--bg-surface-1)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    marginTop: '24px',
    overflow: 'hidden',
  }}>
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)',
                  background: 'var(--bg-surface-2)' }}>
      <h2 style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
                   fontWeight: 600, textTransform: 'uppercase',
                   letterSpacing: '0.1em', color: 'var(--fg-3)', margin: 0 }}>
        Section Label
      </h2>
    </div>
    <div style={{ padding: '16px' }}>
      {/* content */}
    </div>
  </section>
</div>
```

### Template C — Multi-step wizard (Setup pattern)

Used for: setup wizard, confirmation dialogs, full-screen onboarding.
Suppresses the TopBar entirely.

### Template D — Column header (inside 3-col layout)

```jsx
<div style={{
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-hairline)',
  display: 'flex', alignItems: 'center', gap: '8px',
  background: 'var(--bg-surface-2)',
  flexShrink: 0,
}}>
  <span style={{
    width: '6px', height: '6px', borderRadius: '50%',
    background: 'var(--accent)',
    animation: 'pulse 2s ease-in-out infinite',
  }} />
  <span style={{
    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em',
    color: 'var(--fg-2)',
  }}>ARGUS ACTIVITY</span>
  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)',
                 fontSize: 'var(--text-xs)', color: 'var(--fg-4)' }}>
    12 tool calls
  </span>
</div>
```

---

## 6. Authentication Architecture

### Flows

| Flow | Steps |
|---|---|
| Register | email+password → bcrypt → OTP emailed (sha256 stored) → JWT issued |
| Login | bcrypt.compare → JWT (15m) + refresh (7d) as httpOnly cookies |
| Refresh | refreshToken verified → tokenVersion checked → new accessToken |
| Reset | OTP emailed (sha256 stored, 20m TTL) → submit → new password |
| Force logout | increment `tokenVersion` → all existing tokens invalidated |

### Token Storage Rules

- Access token → httpOnly cookie `accessToken` (never localStorage)
- Refresh token → httpOnly cookie `refreshToken` (never localStorage)
- API key (raw) → shown once at creation, only SHA-256 hash stored
- OTP (raw) → emailed, only SHA-256 hash stored

### Middleware Chain (server)

```
verifyJWT           — validates JWT, checks user.isActive, checks tokenVersion
  └─ requireRole    — ['super_admin'] | ['org_admin', 'super_admin'] | etc.
       └─ scopeToOrg — attaches req.orgFilter = { orgId: user.orgId }
                       checks org suspended (Redis cache, 5min TTL)
```

**Always use `req.orgFilter` in queries — never trust client-supplied orgId.**

### Setup Gate Logic

- All authenticated users (except super_admin) check the `ridgeway_setup` cookie
- `ridgeway_setup=0` → redirect to `/setup`
- `ridgeway_setup=1` → allow access to app routes
- `super_admin` (checked via `ridgeway_role` cookie) bypasses this gate entirely

### Client Cookies in Use

| Cookie | Purpose | Set on | Cleared on |
|---|---|---|---|
| `ridgeway_auth` | Auth presence flag | Login/register success | Logout |
| `ridgeway_role` | User role for middleware | Login/register success | Logout |
| `ridgeway_setup` | Setup completion flag (0/1) | Login + register + setup complete | Logout |

All three cookies must be cleared on logout. Missing any of them on logout creates session contamination across users on the same browser.

---

## 7. Security Model — What Is and Isn't Encrypted

### In Transit ✅
All external traffic must use HTTPS/TLS. Production: Nginx termination. Dev: localhost HTTP acceptable.

### Passwords ✅
bcrypt, rounds=10. Raw never stored.

### API Keys ✅
SHA-256 hash stored. Raw shown once at creation, never persisted.

### OTPs ✅
SHA-256 hash stored, 20-minute TTL. Raw sent by email only.

### JWTs ✅
Short-lived (15m), httpOnly cookies, tokenVersion for instant invalidation.

### Webhooks ✅
HMAC-SHA256 signed via `X-Sentinel-Signature: sha256=<hex>` using `WEBHOOK_SECRET`.

### MCP gateway ✅
- `.well-known/oauth-authorization-server` — public discovery endpoint (OAuth 2.1), no auth required
- Tool input validation — zod schemas on all 7 tools; strict enums, date regex, ObjectId length(24)
- Audit logging — every `tools/call` writes `mcp.tool_call` to AuditLog with `toolName`, `inputSummary`, `durationMs`, `success`, `errorCode`
- Rate limiting — 60 tool calls/min per API key (Redis, window=60s); max 10 concurrent SSE connections per org (Redis counter, decremented on close)

### MongoDB at rest ⚠️
- Atlas: enable Encrypted Storage Engine
- Self-hosted: enable WiredTiger encryption
- Verify before production

### Redis payloads ⚠️
Job payloads stored plaintext. Use Redis ACLs + TLS (`rediss://`) in production.
Avoid storing PII in BullMQ job data — use document IDs only.

---

## 8. Briefing Page State Machine

The `/briefing` page must handle four states. Auto-detection order:

1. Check `investigationStore` for active `jobId` with status in `['running', 'connecting', 'starting']`
2. Call `GET /api/v1/briefings/latest`
3. Pick state below

| State | When | UI |
|---|---|---|
| 1. Empty | No active job, no briefing | "No briefing yet" + link to /investigate |
| 2. In progress | Active investigation running | "Argus is completing the investigation…" + progress |
| 3. Draft | Briefing exists, status === `draft` | Render document + approve button |
| 4. Approved | Briefing exists, status === `approved` | Read-only + approval timestamp |

**Critical:** state 2 must only render when there is a genuinely active job. The page must not show "0% complete" just because it mounted.

---

## 9. LLM Architecture — Prod vs Test

Argus uses an LLM abstraction (`server/src/ai/llm-client.js`) that routes inference to different providers based on env vars:

| Mode | Provider | Endpoint | Trigger |
|---|---|---|---|
| Production | Anthropic Claude | api.anthropic.com | `USE_LOCAL_LLM=false` |
| Local dev (optional) | LM Studio | localhost:1234/v1 | `USE_LOCAL_LLM=true` |
| Test suite | LM Studio | localhost:1234/v1 | `NODE_ENV=test` |

**All tests run against LM Studio — never against Anthropic.** This makes the suite zero-cost, deterministic, and runnable offline. See HANDOFF.md Wave 5.1 for the full setup.

### Required LM Studio models

- Chat: instruction-tuned with tool/function calling support
  (e.g. `qwen2.5-7b-instruct`, `llama-3.1-8b-instruct`)
- Embeddings: `nomic-embed-text-v1.5` or `bge-small-en-v1.5`

### Test env file

`server/.env.test` (safe to commit, no secrets):

```bash
NODE_ENV=test
USE_LOCAL_LLM=true
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_API_KEY=lm-studio
LOCAL_LLM_MODEL=qwen2.5-7b-instruct
EMBEDDING_BASE_URL=http://localhost:1234/v1
EMBEDDING_MODEL=nomic-embed-text-v1.5

MONGODB_URL=mongodb://localhost:27017/sentinel_test
REDIS_URL=redis://localhost:6379/1
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_SUFFIX=_test

EMAIL_TRANSPORT=stub
WEBHOOK_RECEIVER_URL=http://localhost:8001/_webhook_sink

INVESTIGATION_TIMEOUT_MS=120000
JOB_RETRY_DELAY_MS=500
```

---

## 10. API Reference Summary

All routes prefixed `/api/v1`. Auth = JWT cookie or `Authorization: Bearer <token>`.

### Auth
```
POST   /auth/register              — public
POST   /auth/login                 — public
POST   /auth/verify-email          — public
POST   /auth/refresh-token         — public
POST   /auth/forgot-password       — public
POST   /auth/reset-password        — public
POST   /auth/logout                — JWT
GET    /auth/current-user          — JWT
POST   /auth/change-password       — JWT
```

### Data
```
GET    /events                     — JWT (query: nightDate)
GET    /events/:id                 — JWT
PATCH  /events/:id/review          — JWT

GET    /incidents                  — JWT (query: nightDate, status, severity)
GET    /incidents/:id              — JWT
GET    /incidents/:id/graph        — JWT (evidence graph)

POST   /investigations/start       — JWT
GET    /investigations/:jobId/stream — JWT (SSE)
GET    /investigations/:id         — JWT

GET    /briefings/latest           — JWT
PATCH  /briefings/:id/sections/:name — JWT
POST   /briefings/:id/approve      — JWT
```

### Org (org_admin+)
```
GET    /org/me                     — JWT (org_admin+)
PATCH  /org/me/config              — JWT (org_admin+)
POST   /org/setup/complete         — JWT (org_admin+)
POST   /org/users/invite           — JWT (org_admin+)
GET    /org/users                  — JWT (org_admin+)
GET    /org/api-keys               — JWT (org_admin+)
POST   /org/api-keys               — JWT (org_admin+)
DELETE /org/api-keys/:keyId        — JWT (org_admin+)
```

### Map & Drones
```
GET    /map/geometry               — JWT
GET    /map/events                 — JWT (query: nightDate)
GET    /map/drones/route/:patrolId — JWT
GET    /map/drones/:patrolId/state — JWT (query: time)
POST   /map/drones/simulate-mission — JWT
```

### MCP (API key, mcp scope)
```
GET    /mcp                        — SSE connection
POST   /mcp/messages?sessionId=    — JSON-RPC (60 calls/min)
```

### Drone Event Ingestion

```json
POST /api/v1/events
Authorization: Bearer <org-api-key>
Content-Type: application/json

{
  "type": "motion_detected" | "badge_swipe_fail" | "vehicle_entry" |
          "fence_alert" | "environmental",
  "timestamp": "2026-04-16T02:34:15.000Z",
  "location": {
    "name": "North Gate",
    "zone": "perimeter",
    "coordinates": { "lat": 51.5074, "lng": -0.1278 }
  },
  "severity": "minor" | "serious" | "harmless",
  "rawData": { /* sensor-specific */ }
}
```

---

## 11. Environment Variables

```bash
# App
NODE_ENV=development | production | test
PORT=8000
CLIENT_URL=http://localhost:3000

# Databases
MONGODB_URL=mongodb://user:pass@host:27017/sentinel?authSource=admin
REDIS_URL=redis://:pass@localhost:6379          # rediss:// in production
QDRANT_URL=http://localhost:6333

# Auth
ACCESS_TOKEN_SECRET=<64-char random string>
REFRESH_TOKEN_SECRET=<64-char random string>
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# LLM — prod
ANTHROPIC_API_KEY=sk-ant-...
# LLM — test/dev with LM Studio
USE_LOCAL_LLM=true
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_API_KEY=lm-studio
LOCAL_LLM_MODEL=qwen2.5-7b-instruct
EMBEDDING_BASE_URL=http://localhost:1234/v1
EMBEDDING_MODEL=nomic-embed-text-v1.5

# Webhooks
WEBHOOK_SECRET=<64-char random string>          # HMAC-SHA256 signing key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=app-password
EMAIL_FROM_NAME=Sentinel
EMAIL_FROM_ADDRESS=noreply@sentinel.io

# Sentry
SENTRY_DSN=https://...@sentry.io/...
```

---

## 12. Development Commands

```bash
# Full stack
docker compose up

# Server only (watch mode)
cd server && bun run dev

# Client only
cd client && npm run dev

# Test suite (LM Studio must be running on :1234)
cd server && bun run test:agentic

# Seed test data
cd server && MONGODB_URL=... bun run src/scripts/seedTestData.js
```

---

## 13. Code Style Rules

- **No `console.log` in production code** — use `pino`: `logger.info({...}, 'message')`
- **All DB queries must include `req.orgFilter`** — never query without org scope
- **Always use `asyncHandler()`** — wrap all async Express controllers
- **Throw `ApiError`, not plain `Error`** — `throw new ApiError(404, 'Not found')`
- **Return `ApiResponse`** — `res.status(200).json(new ApiResponse(200, data, 'message'))`
- **No hardcoded hex colors** — use CSS tokens for any operator-facing UI
- **No Tailwind colour utilities** in main app — admin panel exempt until rewritten
- **Keep agent tools idempotent** — tool calls may be retried by the ReAct loop
- **Never store raw secrets** — passwords: bcrypt, OTPs/keys: sha256
- **All UI agent references say "Argus"** — never "the agent" or "Claude" in user copy

---

## 14. Incident Lifecycle

```
open
  └─ investigating   (Argus running)
       └─ reviewed    (operator has reviewed)
            └─ escalated  (sent to external team)
            └─ closed     (resolved, no action)
```

Severity (set by Argus during classification):

| Level | Meaning | Operator action |
|---|---|---|
| `serious` | Immediate threat — intruder, fire, breach | Escalate |
| `minor` | Needs monitoring — repeated badge fails, unknown vehicle | Review |
| `harmless` | Routine — wildlife, known vehicle, false positive | Close |
| `uncertain` | Insufficient evidence | Request follow-up |

---

## 15. Known Bugs & Fixes — Do Not Repeat

These bugs were found, fixed, and documented. Claude Code must not reintroduce them.

### 15.1 API Response Unwrapping

`client/src/lib/api.js` interceptor already unwraps `response.data` once.
**Never double-unwrap.**

```js
// WRONG
const setupComplete = orgData?.data?.setupComplete;
const key = data?.data?.key;

// CORRECT
const setupComplete = orgData?.setupComplete;
const key = data?.key;
```

### 15.2 Async Callbacks

Any callback using `await` must be declared `async`. Silent fails happen otherwise.

```js
// WRONG — silent fail
onSuccess: (data) => { const org = await getOrgMe(); }

// CORRECT
onSuccess: async (data) => { const org = await getOrgMe(); }
```

### 15.3 Navigation After Auth

Always use `router.replace()` after login, register, setup completion, logout.
`router.push()` adds to the history stack — back button triggers redirect loops.

```js
// WRONG
router.push('/overview');
router.push('/setup');

// CORRECT
router.replace('/overview');
router.replace('/setup');
```

### 15.4 `firstLogin` Field on User Model

When `completeSetup` runs, it must set:
```js
await User.findByIdAndUpdate(req.user._id, { firstLogin: false });
```
Otherwise the welcome banner reappears on every session.

### 15.5 Audit Action Strings

Must be exact dot-separated: `'org.setup.complete'`, `'mcp.tool_call'`,
`'briefing.approved'`. Do not rename — they are stable database identifiers
used for filtering even during product rebranding.

### 15.6 Super Admin Setup Gate

Super admins have no `orgId` and must be exempt from the setup gate in
`middleware.js`. Always check `ridgeway_role` cookie before applying the
setup redirect:

```js
const isSuperAdmin = request.cookies.get('ridgeway_role')?.value === 'super_admin';
if (!isSuperAdmin) {
  // run setup gate
}
```

### 15.7 Logout Must Clear All Three Cookies

Every logout handler must clear:
- `ridgeway_auth`
- `ridgeway_role`
- `ridgeway_setup`

Missing any one causes session contamination when a different user logs in on the same browser.

### 15.8 Settings Pages — Single Unwrap in queryFn

```js
// WRONG — interceptor unwrapped once, queryFn unwraps again
queryFn: async () => {
  const res = await api.get('/org/users');
  return res.data;
}
const members = response?.data || [];

// CORRECT
queryFn: () => api.get('/org/users')
const members = Array.isArray(response) ? response : response?.users ?? [];
```

### 15.9 Investigate Page Auto-Start

The auto-start `useEffect` on `/investigate` was REMOVED. The page must
show a "Start Investigation" empty state when `jobStatus === 'idle'` and
no `jobId` exists. Do not reintroduce the auto-start behaviour.

### 15.10 Briefing Page Stuck at 0%

The briefing page must not render the "Argus is completing the investigation"
progress state unless there is a genuinely active `jobId` with status in
`['running', 'connecting', 'starting']`. See §8 for the full state machine.

### 15.11 Operator Access — Do Not Lock Out

`GET /org/me` must remain accessible to all authenticated users. Operators
need the org name, site name, and `setupComplete` to render `/overview` and
to determine post-login routing. The endpoint returns a reduced payload for
operators (`_id`, `name`, `status`, `setupComplete`, and a trimmed `config`
containing only `siteName`, `industry`, `timezone`, `coordinates`) — no
admin-only fields (`createdBy`, billing, webhook URLs, secrets, etc.).

The global 403 interceptor in `client/src/lib/api.js` must NOT force a
full-page redirect. A 403 on one background API call is not the same as the
user landing on a forbidden page. Show a toast and let the calling code
handle it. The `/forbidden` page is reached only via middleware route
protection (`client/src/middleware.js`). The only 403 that does redirect is
`code === 'ORG_SUSPENDED'`, which sends the user to `/suspended`.

Middleware `/settings` access is per-page, not blanket. Operators may visit
`/settings/documents` (RAG uploads) and `/settings/profile`. Everything else
under `/settings` (general, api-keys, members, webhooks, integrations) is
restricted to `org_admin` and `super_admin`.

### 15.12 Canonical Home Route is `/overview`

The canonical authenticated landing page is `/overview`. `/dashboard` is a
server-side redirect (`redirect('/overview')`) kept only for backwards
compatibility — do NOT render dashboard content there. All post-auth
transitions (`useAuth.js`, login page direct redirects, setup wizard
finish, middleware default `from`) route to `/overview`. TopBar wordmark
and primary nav both link to `/overview`; the Overview tab highlights for
either `/overview` or `/dashboard` (the redirect target).

### 15.13 Accessibility — Severity Without Color

Severity badges must carry an icon alongside the color so color-blind
operators can still distinguish levels. Map:
escalate/serious → AlertTriangle, monitor/minor → Circle,
harmless → CheckCircle, uncertain/unknown → HelpCircle (lucide-react).
The severity filter pills also expose `aria-pressed` reflecting active
state, and a global `*:focus-visible` outline using `--border-focus` is
in `globals.css` — do not remove it.

### 15.15 Map Data Must Be Org-Scoped

All map endpoints (geometry, events, drones, patrols) MUST use
`req.orgFilter`. Defaulting to London (or any hardcoded location) is
forbidden — the map must reflect `org.config.coordinates` or show an
explicit empty state directing the user to configure their site.
Seed data scripts (`seedTestData.js`) are gated behind `ALLOW_SEED_DATA`
env var AND blocked when `NODE_ENV=production`. `getEventPins`,
`getDroneRouteGeometry`, and `getPatrolWaypoints` refuse to query
without an orgFilter. The global `SITE_LOCATIONS`/`SEEDED_PATROL`
fallbacks were removed from the user-facing path — they are
deterministic London coordinates and previously leaked across orgs.

Run `bun run server/src/scripts/cleanup-orphan-data.js` (dry-run) or
`--apply` to remove any orphan rows where `orgId` is null or points
to a non-existent organisation.

### 15.14 Investigate Activity Column Collapses When Idle

When `jobStatus === 'idle' && !jobId && !activityExpanded`, the left
Argus Activity column collapses to a 56px rail with a vertical "ARGUS"
label and a "{n} calls" indicator. The Start Investigation button moves
into an overlay card centered on the map. Clicking the rail sets
`activityExpanded = true` so the user can read the column even with no
active job (shows "No Argus activity yet." empty state). Once an
investigation starts (jobId present or status non-idle), the column
auto-expands back to 360px via state-driven `grid-template-columns`
with a `var(--dur-med) var(--ease-out)` transition.

---

## 16. UX Architecture — How the App Hangs Together

### Landing page (`/`) — public, no auth

Contains:
- Hero with three primary CTAs (Get started, Sign in, Read the docs)
  plus a small `Admin sign in →` link in `--sev-serious`
- 4-stage how-it-works diagram (Patrol → Events → Investigate → Briefing)
- 3 role cards: Operator, Site Manager, Platform Admin
  (Platform Admin uses `--sev-serious` to signal elevated access and
  links to `/admin/login`; operators and site managers link to `/login`)
- 3-step getting started guide (Create → Setup wizard → Connect drones)
- Footer with 4 columns: Brand, Product, Resources, Status

### Entry points

```
/ (landing)        → /login or /docs (both public)
/docs              → PUBLIC, no auth, the documentation
/login             → /overview (if setupComplete) or /setup (if not)
/register          → /setup (always — new orgs)
/setup             → /overview on completion
```

### Authenticated user flow

```
/overview          → morning hub, links to /investigate and /briefing
/investigate       → run investigation, view map, Argus activity feed
/incident/[id]     → detail with evidence
/briefing          → review and approve briefing (4 states — see §8)
/settings/*        → org config, members, documents, webhooks, integrations
/admin/*           → super_admin only, separate layout
```

### Navigation

- TopBar is present on all authenticated non-admin pages
- TopBar links: OVERVIEW, INVESTIGATE, BRIEFING, DOCS, SETTINGS, user menu
- `/admin/*` uses its own sidebar layout (no TopBar)
- `/setup` and `/docs` suppress TopBar entirely (full-screen)

### Design consistency

ALL authenticated pages must use Night Watch CSS tokens. NO Tailwind
light-theme classes in any page visible to operators or org_admins.
The admin panel (super_admin only) is exempt until a future pass.

---

## 17. Current Completion Status

See HANDOFF.md for the full wave-by-wave plan. Quick status:

| Area | Status |
|---|---|
| Auth + JWT + RBAC | ✅ Done |
| First-run setup wizard | ✅ Done |
| Admin login (super_admin exempt) | ✅ Done |
| Investigate page (no auto-start) | ✅ Done |
| Setup completion flow | ✅ Done |
| Sentinel/Argus naming pass | ✅ Done |
| TopBar account dropdown (caret, aria, kbd nav, role-aware Settings) | ✅ Done |
| /overview canonical route (dashboard redirects) | ✅ Done |
| Severity icons + global focus-visible + filter aria-pressed | ✅ Done |
| Investigate idle-collapse Argus rail + map overlay CTA | ✅ Done |
| Public landing page with role-based entry points | ✅ Done |
| Map data org-scoped + empty states (no London leak) | ✅ Done |
| Webhook worker (HMAC signing) | ⏳ Wave 1 |
| Briefing state machine (4 states) | ⏳ Wave 1 |
| Overview page real data + clickable cards | ⏳ Wave 1 |
| Argus completion notification | ⏳ Wave 1 |
| Settings Night Watch migration | ⏳ Wave 2 |
| MCP audit logging | ✅ Done |
| RAG approval workflow | ⏳ Wave 3 |
| RAG citations in incidents | ⏳ Wave 3 |
| Public /docs page | ⏳ Wave 4 |
| Agentic flow test suite (LM Studio) | ⏳ Wave 5 |
| Production hardening (helmet, mongo-sanitize, pino) | ⏳ Wave 5 |

When a wave ships, update this table and add the relevant patterns to §15 if any new bugs were found.

---

*Last updated: 2026-05-14*
*Maintained by: Sentinel development team*
