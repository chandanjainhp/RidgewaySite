# Sentinel — Overnight Intelligence Platform

> **Sentinel** transforms fragmented overnight sensor data from industrial sites into validated morning briefings. **Argus** is the AI agent inside it. **Night Watch** is the design language.

---

## Table of Contents

1. [What Sentinel Does — The Core Loop](#1-what-sentinel-does--the-core-loop)
1.5. [Release & Feature Roadmap](#15-release--feature-roadmap)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Data Models](#5-data-models)
6. [Authentication & Security](#6-authentication--security)
7. [Argus — The AI Agent](#7-argus--the-ai-agent)
8. [MCP Server](#8-mcp-server)
9. [Queue System (BullMQ)](#9-queue-system-bullmq)
10. [RAG Pipeline](#10-rag-pipeline)
11. [Webhooks](#11-webhooks)
12. [API Reference](#12-api-reference)
13. [Frontend Pages & State](#13-frontend-pages--state)
14. [Design System — Night Watch](#14-design-system--night-watch)
15. [Environment Variables](#15-environment-variables)
16. [Docker Setup](#16-docker-setup)
17. [Development Commands](#17-development-commands)
18. [Testing](#18-testing)
19. [Production Deployment](#19-production-deployment)
20. [Roles & Permissions](#20-roles--permissions)
21. [Incident Lifecycle](#21-incident-lifecycle)
22. [Briefing State Machine](#22-briefing-state-machine)
23. [Known Gotchas & Fixed Bugs](#23-known-gotchas--fixed-bugs)
24. [Naming Reference](#24-naming-reference)

---

## 1. What Sentinel Does — The Core Loop

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

Every UI decision, every route, every feature serves this loop. The single test of "done": can an operator understand what happened last night in under 5 minutes?

---

## 1.5. Release & Feature Roadmap

To ensure a production-quality release with mitigated operational and engineering risk, the features of Sentinel are structured into four progressive versions:

### Version 1: The Core MVP (6-Week Release Plan)
* **Goal:** A stable, single-tenant incident clearinghouse buildable by a single developer in 6 weeks.
* **Features:**
  * **User Authentication & Basic RBAC:** Secure JWT-based registration, login, and basic operator/admin segregation.
  * **Event Ingestion API:** High-throughput `POST /api/v1/events` endpoint for physical drones/sensors using API key verification.
  * **Time/Location Event Correlation Engine:** BullMQ background worker to group raw events (motion, badges, fence alerts) into incidents by proximity.
  * **Operator Workspace:** Dashboard featuring incidents filter (priority, severity), incident table, events timeline, map, and review controls.
  * **Manual Review & Override:** Allows operators to review raw alerts, leave comments, adjust incident severity, and close or escalate cases.
  * **Static Morning Briefing Generator:** Automated compile of the morning summary using clean text templates, managed via a state machine (`draft`, `generating`, `approved`).

### Version 2: Collaboration & Integrations
* **Goal:** Expand Sentinel into a multi-tenant platform for collaborative security teams.
* **Features:**
  * **Multi-Tenant Org Scoping:** Organization model, signup setup wizard, and database queries scoped strictly by `orgId`.
  * **Org Membership & Invite Flow:** Simple email-based member invitation (`inviteToken`) with roles (`operator`, `org_admin`).
  * **Outbound Notification Webhooks:** Outgoing webhooks to Slack, Teams, or log systems upon briefing approval, signed with HMAC-SHA256.
  * **Collaborative Notes:** Incident comments, annotations, and operator shift handover logs.

### Version 3: AI-Powered Autonomous Investigation
* **Goal:** Introduce deep automation with the autonomous investigation agent (**Argus**) and contextual site grounding.
* **Features:**
  * **Argus Autonomous Agent:** Claude-powered ReAct loop querying badge logs, drone routes, vehicle databases, and environment statuses.
  * **Qdrant Vector RAG Pipeline:** PDF document chunking, indexing, and injection of site guidelines into the agent's prompts.
  * **Real-Time Agent reasoning trace (SSE):** Streaming agent thought process and tool execution history directly to the UI.
  * **Overnight Automation Scheduler:** Cron-scheduled background workers executing correlation and AI investigation overnight.

### Version 4: Enterprise Compliance & Scale
* **Goal:** Meet security compliance certifications, scale database operations, and enable developer tooling.
* **Features:**
  * **Model Context Protocol (MCP) Server:** Standard SSE MCP server to link external developer agents to site tools.
  * **Super-Admin Portal:** Centralized dashboard for managing orgs, users, platform API keys, and BullMQ jobs.
  * **SSO & Immutable Audit Logging:** SAML/OIDC enterprise integration and tamper-proof security audit log persistence.
  * **Advanced 3D Map Visualizations:** React Three Fiber 3D drone routes and site zone boundaries on the dashboard.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Client (Next.js 16 / React 19)             :3000           │
│  Night Watch design system, Zustand + React Query           │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────────────┐
│  Server (Express.js on Bun)                 :8000           │
│  JWT auth · RBAC · org-scoped queries                       │
│  BullMQ workers · Argus ReAct loop · MCP SSE server         │
└──┬──────────────┬────────────────┬───────────────┬──────────┘
   │              │                │               │
┌──▼───┐  ┌──────▼──────┐  ┌──────▼─────┐  ┌─────▼──────┐
│Mongo │  │   Redis     │  │  Qdrant    │  │ Anthropic  │
│  DB  │  │ cache+queue │  │  vectors   │  │ Claude API │
│:27017│  │   :6379     │  │   :6333    │  │            │
└──────┘  └─────────────┘  └────────────┘  └────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Client framework | Next.js | 16.0.10 |
| Client UI | React | 19.2.0 |
| Client styling | Tailwind CSS | 4.x |
| Client state | Zustand | 5.x |
| Client data fetching | TanStack React Query | v5 |
| Client HTTP | Axios | 1.x |
| Client maps | Leaflet + react-leaflet | 1.9.4 / 5.x |
| Client charts | Recharts | 2.15.4 |
| Client UI primitives | Radix UI (full suite) | various |
| Client 3D | React Three Fiber + Three.js | — |
| Client animations | Framer Motion | 12.x |
| Client forms | React Hook Form + Zod | — |
| Server runtime | Bun | latest |
| Server framework | Express.js | 4.x |
| Database | MongoDB | 7.0 |
| ORM | Mongoose | 8.x |
| Cache & job queues | Redis 7 + ioredis + BullMQ | — |
| Vector database | Qdrant | latest |
| AI (production) | Anthropic Claude SDK — `claude-sonnet-4-5` | 0.24.x |
| AI (test/dev) | LM Studio (OpenAI-compatible) at `localhost:1234/v1` | — |
| MCP | `@modelcontextprotocol/sdk` | 1.29.x |
| Auth | JWT + bcrypt + SHA-256 OTP | — |
| Rate limiting | express-rate-limit + Redis sliding window | — |
| Logging | Pino + pino-http | 10.x |
| Error monitoring | Sentry | 10.x |
| Email | Nodemailer + Mailgen | — |
| Validation (routes) | express-validator | 7.x |
| Validation (MCP) | Zod | 3.x |

---

## 4. Project Structure

```
RidgewaySite/
├── client/                          # Next.js 16 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.js              # Landing page (public) — hero, role cards, how-it-works
│   │   │   ├── login/               # JWT login
│   │   │   ├── register/            # Registration (creates org) → /setup
│   │   │   ├── forgot-password/
│   │   │   ├── reset-password/
│   │   │   ├── invite/accept/       # Accept org invite via token
│   │   │   ├── setup/               # 4-step first-run wizard (suppresses TopBar)
│   │   │   ├── overview/            # Morning hub — canonical authenticated home
│   │   │   ├── dashboard/           # Server-side redirect → /overview (backwards compat)
│   │   │   ├── investigate/         # 3-column: Argus feed + map + events panel
│   │   │   ├── briefing/            # Briefing document (4 states — see §22)
│   │   │   ├── incident/[id]/       # 2-pane case file: evidence chain + map
│   │   │   ├── profile/
│   │   │   ├── docs/                # Public documentation (no auth required)
│   │   │   ├── forbidden/           # 403 via middleware route protection
│   │   │   ├── suspended/           # Org suspended page
│   │   │   ├── settings/
│   │   │   │   ├── layout.jsx       # Settings sidebar layout
│   │   │   │   ├── api-keys/        # Org API key management
│   │   │   │   ├── documents/       # RAG upload + approval (operator+)
│   │   │   │   ├── general/         # Org profile (org_admin+)
│   │   │   │   ├── integrations/    # MCP activity log (org_admin+)
│   │   │   │   ├── members/         # Invite + roles (org_admin+)
│   │   │   │   └── webhooks/        # Webhook config + deliveries (org_admin+)
│   │   │   └── admin/               # Super-admin panel (own layout, no TopBar)
│   │   │       ├── layout.jsx       # Admin sidebar layout
│   │   │       ├── login/           # Super admin login
│   │   │       ├── orgs/            # Org management + per-org detail
│   │   │       ├── users/           # User management
│   │   │       ├── audit/           # Audit log viewer
│   │   │       ├── apikeys/         # Platform API keys
│   │   │       └── jobs/            # BullMQ job monitor
│   │   ├── components/
│   │   │   ├── agent/               # AgentFeed, AgentFeedItem, AgentStatusBadge
│   │   │   ├── briefing/            # BriefingDocument, BriefingSection, ApproveButton
│   │   │   ├── events/              # EventCard, EventPanel, SeverityBadge
│   │   │   ├── incident/            # EvidenceChain, EvidenceStep, ReviewControls,
│   │   │   │                        #   ReviewFlagForm, ReviewOverrideForm, AgentReasoning,
│   │   │   │                        #   IncidentMiniMap, ReviewActionRow, ReviewReadOnlyState
│   │   │   ├── layout/              # TopBar, StatusBar, AppShell, RootFrame
│   │   │   ├── map/                 # SiteMap, DroneRoute, EventPin, DroneTimeline
│   │   │   ├── shared/              # Button, Card, EmptyState, LoadingSpinner,
│   │   │   │                        #   ConfidenceBar, ConnectionStatus, AppErrorBoundary
│   │   │   └── ui/                  # Radix primitives wrapped in Night Watch tokens
│   │   ├── store/
│   │   │   ├── authStore.js         # user, org, login/logout, token refresh
│   │   │   ├── investigationStore.js # jobId, jobStatus, activityItems, activityExpanded
│   │   │   ├── mapStore.js          # events, drone routes, selected event, date filter
│   │   │   └── reviewStore.js       # current review state, override/flag forms
│   │   ├── hooks/
│   │   │   ├── useAgentStream.js    # SSE stream from investigation endpoint
│   │   │   ├── useAuth.js           # auth state + redirect helpers
│   │   │   ├── useBriefing.js       # briefing data + approve mutation
│   │   │   ├── useDroneReplay.js    # drone route replay timeline
│   │   │   ├── useIncidents.js      # incident list + detail queries
│   │   │   ├── useInvestigation.js  # start investigation + job status
│   │   │   └── useSiteMap.js        # map geometry + event pins
│   │   ├── lib/
│   │   │   ├── api.js               # axios instance — unwraps response.data ONCE
│   │   │   ├── auth.js              # auth helpers
│   │   │   ├── formatters.js        # date/time/severity formatters
│   │   │   ├── sse.js               # SSE client utility
│   │   │   ├── theme.js             # Night Watch token helpers
│   │   │   └── validation.js        # shared Zod schemas
│   │   ├── colors_and_type.css      # Night Watch design tokens — LAW for all styling
│   │   └── middleware.js            # Auth gate + setup gate + role gate
│   ├── styles/globals.css
│   ├── tailwind.config.js
│   ├── package.json
│   └── Dockerfile
│
├── server/src/
│   ├── ai/
│   │   ├── agent.js                 # Argus — Claude ReAct loop (max 12 tool calls)
│   │   ├── memory.js                # Redis conversation context + site facts cache
│   │   ├── planner.js               # Investigation planning utilities
│   │   ├── tools-registry.js        # Tool definitions + dispatcher
│   │   └── prompts/system.js        # System prompt builder (org context + RAG)
│   ├── controllers/
│   │   ├── admin.controller.js
│   │   ├── auth.controllers.js
│   │   ├── briefing.controller.js
│   │   ├── event.controller.js
│   │   ├── incident.controller.js
│   │   ├── investigation.controller.js
│   │   ├── map.controller.js
│   │   ├── org.controller.js
│   │   ├── review.controller.js
│   │   └── healthcheck.controllers.js
│   ├── db/
│   │   ├── mongo.js                 # MongoDB connection
│   │   ├── redis.js                 # Redis connection
│   │   ├── graph.js                 # In-memory evidence graph
│   │   └── seed.js                  # Seed helpers
│   ├── mcp/server.js                # MCP SSE server — 7 tools, Zod-validated
│   ├── middlewares/
│   │   ├── auth.middleware.js       # verifyJWT, verifyApiKey, requireRole, scopeToOrg
│   │   ├── error.middleware.js      # Global error handler
│   │   ├── rateLimit.middleware.js  # Redis-backed per-key rate limiter
│   │   ├── requestLogger.middleware.js
│   │   ├── upload.middleware.js     # multer config
│   │   ├── validation.middleware.js
│   │   └── validator.middleware.js
│   ├── models/
│   │   ├── apiKey.model.js          # API keys (SHA-256 hash stored, raw never persisted)
│   │   ├── auditLog.model.js        # Immutable audit trail
│   │   ├── briefing.model.js        # Morning briefing document
│   │   ├── event.model.js           # Drone sensor events
│   │   ├── incident.model.js        # Correlated incident records
│   │   ├── investigation.model.js   # Argus investigation results
│   │   ├── organisation.model.js    # Multi-tenant orgs
│   │   ├── ragDocument.model.js     # Uploaded RAG documents + approval state
│   │   ├── review.model.js          # Operator reviews of events
│   │   ├── user.models.js           # Users with RBAC roles
│   │   └── webhookDelivery.model.js # Webhook delivery records
│   ├── queues/
│   │   ├── event.queue.js           # Ingest + correlate sensor events → incidents
│   │   ├── investigation.queue.js   # Dispatch Argus per incident
│   │   ├── rag.queue.js             # Chunk → embed → store in Qdrant
│   │   ├── webhook.queue.js         # Deliver briefing approval webhooks
│   │   └── worker.js                # BullMQ worker definitions
│   ├── routes/
│   │   ├── admin.routes.js
│   │   ├── auth.routes.js
│   │   ├── briefing.routes.js
│   │   ├── event.routes.js
│   │   ├── incident.routes.js
│   │   ├── investigation.routes.js
│   │   ├── map.routes.js
│   │   ├── mcp.routes.js
│   │   ├── org.routes.js
│   │   └── review.routes.js
│   ├── scripts/
│   │   ├── bootstrap-admin.js       # Create first super_admin user
│   │   ├── cleanup-orphan-data.js   # Remove null-orgId rows (--apply flag)
│   │   ├── seedTestData.js          # Gated by ALLOW_SEED_DATA, blocked in prod
│   │   ├── clearSeedData.js         # Remove seeded records only
│   │   └── migrate-review-orgId.js  # One-off migration for pre-RBAC reviews
│   ├── services/
│   │   ├── briefing.service.js      # Build + retrieve briefing documents
│   │   ├── correlation.service.js   # Event → incident correlation logic
│   │   ├── embedding.service.js     # Text → vector embeddings
│   │   ├── event.service.js
│   │   ├── investigation.service.js
│   │   ├── rag.service.js           # Qdrant query + document chunking
│   │   └── webhook.service.js       # HMAC-signed delivery
│   ├── tests/
│   │   └── agentic-flow.test.js     # Full ReAct loop end-to-end test (LM Studio)
│   ├── tools/                       # Argus tool implementations
│   │   ├── accessControl.tool.js    # Badge records, gate status, employee schedules
│   │   ├── droneSimulator.tool.js   # Drone position history, patrol routes
│   │   ├── environmentalSensor.tool.js  # Temperature, humidity, gas sensors
│   │   ├── logs.tool.js             # Site activity logs, shift handover notes
│   │   ├── map.tool.js              # Zone geometry, restricted area boundaries
│   │   └── vehicleRegistry.tool.js  # Vehicle database lookup by plate/description
│   ├── utils/
│   │   ├── api-error.js             # ApiError class
│   │   ├── api-response.js          # ApiResponse class
│   │   ├── async-handler.js         # asyncHandler() — wrap all async controllers
│   │   ├── audit.js                 # Audit log writer
│   │   ├── anthropic.js             # LLM abstraction: Anthropic or LM Studio
│   │   ├── constants.js
│   │   ├── logger.js                # Pino instance
│   │   └── mail.js                  # Nodemailer helpers
│   ├── validators/                  # express-validator schemas per route
│   ├── lib/streamRegistry.js        # In-memory Map: jobId → SSE response
│   ├── app.js                       # Express app setup
│   └── index.js                     # Entry point
│
├── docker-compose.yml               # Development stack
├── docker-compose.prod.yml          # Production stack with resource limits
├── .dockerconfig.yaml               # Docker config reference
├── CLAUDE.md                        # Full architecture + conventions (for AI)
├── HANDOFF.md                       # Wave-by-wave build plan
└── AUDIT.md                         # Security audit log
```

---

## 5. Data Models

### User
```
role: 'super_admin' | 'org_admin' | 'operator'
orgId: ObjectId → Organisation       (null for super_admin)
isActive: Boolean
tokenVersion: Number                 — incremented on force logout invalidates all tokens
firstLogin: Boolean                  — set to false after setup completion
email: String (unique, lowercase)
username: String (unique, lowercase)
password: String (bcrypt, rounds=10)
isEmailVerified: Boolean
refreshToken: String
forgotPasswordToken: String          — SHA-256, 20min TTL
emailVerificationToken: String       — SHA-256, 20min TTL
inviteToken: String                  — SHA-256, 48hr TTL (invite-based registration)
lastLoginAt: Date
avatar: { url, localPath }
timestamps: createdAt, updatedAt
```

### Organisation
```
name: String
slug: String (unique, auto-generated from name, URL-safe)
status: 'pending' | 'active' | 'suspended'
plan: 'trial' | 'standard' | 'enterprise'
setupComplete: Boolean
createdBy: ObjectId → User
config:
  siteName: String
  industry: String
  timezone: String
  coordinates: { lat: Number, lng: Number }
  webhookUrl: String
  webhookSecret: String                — HMAC-SHA256 signing key
  webhookEnabled: Boolean
  siteGeometry: Mixed                  — GeoJSON for site map overlay
  aiPromptOverride: String             — per-org Argus system prompt override
  smtpOverride: Mixed                  — per-org email server override
  usageLimits:
    eventsPerDay: Number (default 10000)
    apiCallsPerMonth: Number (default 50000)
timestamps: createdAt, updatedAt
```

### Event (drone sensor data)
```
type: 'motion_detected' | 'badge_swipe_fail' | 'vehicle_entry' |
      'fence_alert' | 'environmental'
timestamp: Date
orgId: ObjectId                      — always present, never null
nightDate: String (YYYY-MM-DD)       — night the event belongs to
location: { name, zone, coordinates: { lat, lng } }
severity: 'minor' | 'serious' | 'harmless'
rawData: Mixed                       — sensor-specific payload
reviewed: Boolean
incidentId: ObjectId → Incident      — populated after correlation
```

### Incident
```
orgId: ObjectId
nightDate: String (YYYY-MM-DD)
title: String
description: String
severity: 'serious' | 'minor' | 'harmless' | 'uncertain'
status: 'open' | 'investigating' | 'reviewed' | 'escalated' | 'closed'
eventIds: [ObjectId → Event]
investigationId: ObjectId → Investigation
briefingId: ObjectId → Briefing
timestamps: createdAt, updatedAt
```

### Investigation
```
orgId: ObjectId
incidentId: ObjectId
jobId: String                        — BullMQ job ID (SSE channel key)
status: 'pending' | 'running' | 'completed' | 'failed'
toolCallSequence: [{
  toolName: String,
  input: Mixed,
  output: Mixed,
  durationMs: Number
}]
evidenceChain: [{
  type: String,
  description: String,
  confidence: Number,
  timestamp: Date
}]
classification: {
  severity: String,
  confidence: Number,
  reasoning: String
}
briefingSummary: String
tokenUsage: { inputTokens: Number, outputTokens: Number }
startedAt: Date
completedAt: Date
```

### Briefing
```
orgId: ObjectId
nightDate: String (YYYY-MM-DD)
status: 'draft' | 'approved'
sections: [{
  name: String,
  content: String,
  lastEditedAt: Date
}]
approvedBy: ObjectId → User
approvedAt: Date
incidentCount: Number
investigationIds: [ObjectId]
webhookFired: Boolean
```

### API Key
```
orgId: ObjectId
name: String
keyHash: String             — SHA-256 of raw key (raw shown once, never stored)
prefix: String              — first 8 chars for display ("sk_live_xxxx...")
scopes: ['events', 'mcp', 'read']
isActive: Boolean
expiresAt: Date
lastUsedAt: Date
createdBy: ObjectId → User
```

### Audit Log
```
orgId: ObjectId
userId: ObjectId
action: String              — stable dot-separated (e.g. 'mcp.tool_call', 'briefing.approved')
resourceType: String
resourceId: String
metadata: Mixed
ipAddress: String
userAgent: String
timestamp: Date
```

### RAG Document
```
orgId: ObjectId
filename: String
mimeType: String
status: 'pending' | 'processing' | 'approved' | 'rejected'
uploadedBy: ObjectId → User
approvedBy: ObjectId → User
qdrantIds: [String]         — vector IDs in Qdrant collection
chunkCount: Number
```

### Webhook Delivery
```
orgId: ObjectId
briefingId: ObjectId
url: String
statusCode: Number
success: Boolean
responseBody: String
attemptedAt: Date
signature: String           — X-Sentinel-Signature header value sent
```

---

## 6. Authentication & Security

### Auth Flows

| Flow | Steps |
|---|---|
| **Register** | email+password → bcrypt(rounds=10) → 6-digit OTP emailed (SHA-256 stored, 20min TTL) → JWT issued |
| **Login** | bcrypt.compare → accessToken (15m) + refreshToken (7d) as httpOnly cookies |
| **Refresh** | refreshToken verified → tokenVersion checked → new accessToken |
| **Forgot password** | 6-digit OTP emailed (SHA-256, 20min TTL) → submit OTP + new password |
| **Force logout** | increment `tokenVersion` → all existing tokens immediately invalidated |
| **Invite** | org_admin invites → 32-byte random token (SHA-256, 48hr TTL) → link emailed → register |

### Token Storage Rules
- Access token → httpOnly cookie `accessToken` (**never** localStorage)
- Refresh token → httpOnly cookie `refreshToken` (**never** localStorage)
- API keys → raw shown once at creation, only SHA-256 hash stored in DB
- OTPs → emailed to user, only SHA-256 hash stored in DB

### Middleware Chain (server)
```
verifyJWT           — validates JWT, checks user.isActive, checks tokenVersion
  └─ requireRole    — ['super_admin'] | ['org_admin', 'super_admin'] | etc.
       └─ scopeToOrg — attaches req.orgFilter = { orgId: user.orgId }
                       checks org suspended (Redis cache, 5min TTL)
```

**All DB queries must include `req.orgFilter`. Never query without org scope.**

### Client Cookies

| Cookie | Purpose | Set on | Cleared on |
|---|---|---|---|
| `ridgeway_auth` | Auth presence flag | Login/register success | Logout |
| `ridgeway_role` | User role for middleware | Login/register success | Logout |
| `ridgeway_setup` | Setup completion flag (0/1) | Login + register + setup complete | Logout |

All three must be cleared on logout. Missing any one causes session contamination when a different user logs in on the same browser.

### Setup Gate Logic (client middleware)
- All authenticated users except super_admin check `ridgeway_setup` cookie
- `ridgeway_setup=0` → redirect to `/setup`
- `ridgeway_setup=1` → allow app routes
- super_admin (checked via `ridgeway_role` cookie) bypasses entirely

### Webhook Security
Payloads signed via `X-Sentinel-Signature: sha256=<hex>` using `WEBHOOK_SECRET` (HMAC-SHA256).

### MCP Security
- OAuth 2.1 discovery at `/.well-known/oauth-authorization-server` (public endpoint, no auth)
- All 7 tool inputs validated with Zod schemas (strict enums, date regex `/^\d{4}-\d{2}-\d{2}$/`, ObjectId `.length(24)`)
- Every `tools/call` writes `mcp.tool_call` to AuditLog with `toolName`, `inputSummary`, `durationMs`, `success`, `errorCode`
- 60 tool calls/min per API key (Redis sliding window, `window=60s`)
- Max 10 concurrent SSE connections per org (Redis counter, decremented on close)

### Production Security Notes
- MongoDB Atlas: enable Encrypted Storage Engine
- Redis: use `rediss://` (TLS) + ACLs in production
- BullMQ job payloads stored plaintext in Redis — store document IDs only, no PII

---

## 7. Argus — The AI Agent

Argus is a ReAct (Reason + Act) loop implemented in `server/src/ai/agent.js`. Uses Claude `claude-sonnet-4-5` in production and LM Studio in test/dev.

### Investigation Flow
```
1. Load incident + associated events from MongoDB (populated)
2. Query RAG (Qdrant) for relevant site knowledge based on incident context
3. Build system prompt: site context + org config + RAG results + incident data
4. Enter ReAct loop (max 12 iterations):
   a. Send conversation history to Claude
   b. Claude reasons (text) and optionally calls a tool
   c. If tool called → executeTool() → result appended to conversation
   d. Repeat until classification confident or max calls reached
5. Claude produces final classification { severity, confidence, reasoning }
6. Investigation record written to MongoDB with full toolCallSequence + evidenceChain
7. Briefing summary generated and stored
8. SSE stream closed, stream registry entry removed
```

### Available Tools (6 tools)
| Tool | File | Purpose |
|---|---|---|
| `accessControl` | `accessControl.tool.js` | Badge records, gate status, employee schedules, access history |
| `droneSimulator` | `droneSimulator.tool.js` | Drone position history, patrol route playback |
| `environmentalSensor` | `environmentalSensor.tool.js` | Temperature, humidity, gas sensor readings by zone |
| `logs` | `logs.tool.js` | Site activity logs, shift handover notes |
| `map` | `map.tool.js` | Zone geometry, restricted area boundaries, zone names |
| `vehicleRegistry` | `vehicleRegistry.tool.js` | Vehicle database lookup by plate or physical description |

### SSE Progress Events (streamed to client)
| Event type | When fired |
|---|---|
| `connecting` | Worker picked up the job |
| `starting` | Argus initialized, system prompt built |
| `thinking` | Claude's reasoning text (pre-tool-call) |
| `tool_call` | Tool invoked — includes tool name + input summary |
| `tool_result` | Tool response — includes output summary |
| `classification` | Final severity + confidence + reasoning |
| `complete` | Investigation done, record saved |
| `error` | Failure with error message |

### Token Usage Tracking
Each investigation records `inputTokens` and `outputTokens` accumulated across all loop iterations. The extractor handles both Anthropic and OpenAI-compatible response shapes.

### LLM Abstraction
`server/src/utils/anthropic.js` routes inference:
- `USE_LOCAL_LLM=false` (or unset) → Anthropic API (`api.anthropic.com`)
- `USE_LOCAL_LLM=true` → LM Studio (`localhost:1234/v1`, OpenAI-compatible)
- `NODE_ENV=test` → always LM Studio

---

## 8. MCP Server

Sentinel exposes a Model Context Protocol server at `/api/v1/mcp` (SSE transport). External AI assistants connect with an API key (mcp scope) and query site data using 7 tools.

### Connection
```
# Establish SSE session
GET /api/v1/mcp
Authorization: Bearer <api-key with mcp scope>

# Send JSON-RPC messages
POST /api/v1/mcp/messages?sessionId=<session-id>
```

OAuth 2.1 discovery (public, no auth):
```
GET /.well-known/oauth-authorization-server
```

### 7 MCP Tools

| Tool | Description |
|---|---|
| `get_latest_briefing` | Most recent morning briefing; optional `date` (YYYY-MM-DD) param |
| `list_incidents` | Incidents filtered by `startDate`, `endDate`, `severity`, `status`, `limit`, `skip` |
| `get_incident_detail` | Full incident record with evidence chain by `incidentId` |
| `list_events` | Raw sensor events with location + severity; date range filters |
| `get_investigation_detail` | Investigation record with full tool call sequence |
| `start_investigation` | Dispatch a new Argus investigation for an incident |
| `get_site_status` | Org config, event counts, briefing status |

### Rate Limits & Org Scoping
- 60 tool calls/min per API key (Redis sliding window)
- Max 10 concurrent SSE connections per org
- All tool results scoped to the connecting key's org via `extra.orgFilter`
- Every call logged to AuditLog with `action: 'mcp.tool_call'`

---

## 9. Queue System (BullMQ)

### Queues
| Queue | File | Purpose |
|---|---|---|
| `event-queue` | `event.queue.js` | Ingest + correlate incoming drone events → incidents |
| `investigation-queue` | `investigation.queue.js` | Dispatch Argus per incident, SSE stream |
| `rag-queue` | `rag.queue.js` | Chunk → embed → store uploaded docs in Qdrant |
| `webhook-queue` | `webhook.queue.js` | Deliver HMAC-signed briefing approval webhooks with retry |

### Investigation Queue Flow
```
POST /api/v1/investigations/start
  → investigation.queue.add({ incidentId, orgId, investigationId })
  → worker.js picks up job
  → streamRegistry.set(jobId, res)   (SSE response stored in-memory)
  → runInvestigation(incidentId, jobId, emitProgress)
  → emitProgress() writes to SSE stream
  → investigation record saved to MongoDB
  → briefing generated
  → streamRegistry.delete(jobId)
```

### Stream Registry
`server/src/lib/streamRegistry.js` — in-memory `Map<jobId, SSEResponse>`. Allows the BullMQ worker to push SSE events to the client without a message bus. Workers and SSE controllers run in the same Node process.

### BullMQ Admin (super_admin)
`GET /admin/jobs/stats` — queue depths per queue
`GET /admin/jobs/failed` — failed jobs with error details
`POST /admin/jobs/:queueName/:jobId/retry` — retry failed job
`DELETE /admin/jobs/:queueName/:jobId` — remove job

---

## 10. RAG Pipeline

Uploaded documents are chunked, embedded, and stored in Qdrant with org-scoped filtering.

### Upload Flow
```
POST /api/v1/org/documents/upload (multipart, operator+)
  → multer saves file
  → rag.queue.add({ docId, orgId, filePath })
  → worker: chunk text → embedding.service.generateEmbeddings()
  → store vectors in Qdrant collection (org-scoped suffix)
  → ragDocument.status = 'processing'
  → org_admin approves: POST /org/documents/:docId/approve
  → ragDocument.status = 'approved'
```

### Query (used by Argus)
```js
queryRag(query, orgId)
  → embedding.service.generateEmbeddings(query)
  → Qdrant similarity search filtered by orgId
  → returns top-k chunks as context strings
  → appended to Argus system prompt
```

### Collection Naming
`ridgeway_documents` base name + `QDRANT_COLLECTION_SUFFIX` env var. Test runs use `_test` suffix to isolate from dev data.

---

## 11. Webhooks

### Approval Flow
```
POST /api/v1/briefings/:id/approve
  → briefing.status = 'approved'
  → briefing.approvedBy = req.user._id
  → AuditLog: action 'briefing.approved'
  → webhook.queue.add({ briefingId, orgId, url, secret })
  → worker: HTTP POST to configured URL
  → WebhookDelivery record saved (statusCode, success, body, signature)
```

### Signature
```
X-Sentinel-Signature: sha256=<hex>
X-Sentinel-Event: briefing.approved
```
HMAC-SHA256 over the raw JSON body using `org.config.webhookSecret`.

### Payload
```json
{
  "event": "briefing.approved",
  "briefingId": "...",
  "nightDate": "2026-05-16",
  "orgId": "...",
  "approvedAt": "2026-05-17T07:00:00.000Z",
  "incidentCount": 3
}
```

### Webhook Management (org_admin)
```
GET    /org/webhooks/config
PUT    /org/webhooks/config
POST   /org/webhooks/rotate-secret
GET    /org/webhooks/deliveries
POST   /org/webhooks/test
POST   /org/webhooks/deliveries/:deliveryId/retry
```

---

## 12. API Reference

All routes prefixed `/api/v1`. Auth = JWT cookie or `Authorization: Bearer <token>` for JWT routes; `Authorization: Bearer sk_live_...` for API key routes.

### Auth (public)
```
POST /auth/register
POST /auth/login
POST /auth/verify-email
POST /auth/refresh-token
POST /auth/forgot-password
POST /auth/reset-password
```

### Auth (JWT required)
```
POST /auth/logout
GET  /auth/current-user
POST /auth/change-password
POST /auth/resend-email-verification
```

### Events
```
POST   /events                        — API key (events scope) — drone sensor ingestion
GET    /events                        — JWT (query: nightDate)
GET    /events/:id                    — JWT
PATCH  /events/:id/review             — JWT
```

Drone ingestion payload:
```json
{
  "type": "motion_detected|badge_swipe_fail|vehicle_entry|fence_alert|environmental",
  "timestamp": "2026-05-16T02:34:15.000Z",
  "location": {
    "name": "North Gate",
    "zone": "perimeter",
    "coordinates": { "lat": 51.5074, "lng": -0.1278 }
  },
  "severity": "minor|serious|harmless",
  "rawData": {}
}
```

### Incidents
```
GET    /incidents                     — JWT (query: nightDate, status, severity)
GET    /incidents/:id                 — JWT
GET    /incidents/:id/graph           — JWT (evidence graph JSON)
```

### Investigations
```
POST   /investigations/start          — JWT
GET    /investigations/:jobId/stream  — JWT (SSE — real-time progress)
GET    /investigations/:id            — JWT
```

### Briefings
```
GET    /briefings/latest              — JWT (query: nightDate optional)
PATCH  /briefings/:id/sections/:name  — JWT (inline edit)
POST   /briefings/:id/approve         — JWT (fires webhook)
```

### Reviews
```
POST   /reviews                       — JWT
GET    /reviews/night/:date           — JWT
```

### Map & Drones (all org-scoped, no hardcoded coordinates)
```
GET    /map/geometry                  — JWT (site GeoJSON from org config)
GET    /map/events                    — JWT (query: nightDate) — event pins
GET    /map/drones/route/:patrolId    — JWT
GET    /map/drones/:patrolId/state    — JWT (query: time)
POST   /map/drones/simulate-mission   — JWT
```

### Org (all roles get reduced payload, org_admin+ gets full config)
```
GET    /org/me                        — JWT (all authenticated roles)
PATCH  /org/me/config                 — JWT (org_admin+)
POST   /org/setup/complete            — JWT (org_admin+)
POST   /org/users/invite              — JWT (org_admin+)
GET    /org/users                     — JWT (org_admin+)
GET    /org/api-keys                  — JWT (org_admin+)
POST   /org/api-keys                  — JWT (org_admin+)
DELETE /org/api-keys/:keyId           — JWT (org_admin+)
GET    /org/webhooks/config           — JWT (org_admin+)
PUT    /org/webhooks/config           — JWT (org_admin+)
POST   /org/webhooks/rotate-secret    — JWT (org_admin+)
GET    /org/webhooks/deliveries       — JWT (org_admin+)
POST   /org/webhooks/test             — JWT (org_admin+)
POST   /org/webhooks/deliveries/:id/retry — JWT (org_admin+)
GET    /org/mcp/activity              — JWT (org_admin+)
```

### RAG Documents
```
POST   /org/documents/upload          — JWT (operator+) multipart
GET    /org/documents                 — JWT (operator+)
GET    /org/documents/:docId          — JWT (operator+)
DELETE /org/documents/:docId          — JWT (operator+)
POST   /org/documents/:docId/approve  — JWT (org_admin+)
POST   /org/documents/:docId/reject   — JWT (org_admin+)
```

### MCP
```
GET    /mcp                           — SSE (API key, mcp scope)
POST   /mcp/messages?sessionId=       — JSON-RPC (60 calls/min per key)
GET    /.well-known/oauth-authorization-server  — public, no auth
```

### Admin (super_admin only)
```
GET    /admin/orgs
POST   /admin/orgs
GET    /admin/orgs/:orgId
PATCH  /admin/orgs/:orgId/status      (suspend/activate)
PATCH  /admin/orgs/:orgId/config
POST   /admin/orgs/:orgId/invite
POST   /admin/orgs/:orgId/resend-invite/:userId

GET    /admin/users
PATCH  /admin/users/:userId/role
POST   /admin/users/:userId/force-logout
PATCH  /admin/users/:userId/status

GET    /admin/apikeys
DELETE /admin/apikeys/:keyId/revoke

GET    /admin/jobs/stats
GET    /admin/jobs/failed
POST   /admin/jobs/:queueName/:jobId/retry
DELETE /admin/jobs/:queueName/:jobId

GET    /admin/audit
```

### Health
```
GET /api/v1/health
```

---

## 13. Frontend Pages & State

### Route Map

| Route | Auth required | Minimum role | Description |
|---|---|---|---|
| `/` | No | — | Landing: hero, how-it-works, role cards |
| `/login` | No | — | JWT login → `/overview` or `/setup` |
| `/register` | No | — | Registration → `/setup` |
| `/forgot-password` | No | — | OTP password reset request |
| `/reset-password` | No | — | Submit OTP + new password |
| `/invite/accept` | No | — | Accept org invite via token |
| `/docs` | No | — | Public documentation |
| `/setup` | JWT | org_admin | 4-step first-run wizard |
| `/overview` | JWT | operator | **Canonical home** — morning hub |
| `/dashboard` | JWT | operator | Server redirect → `/overview` |
| `/investigate` | JWT | operator | 3-column investigation runner |
| `/briefing` | JWT | operator | Briefing document (4 states) |
| `/incident/[id]` | JWT | operator | Case file: evidence + map |
| `/profile` | JWT | operator | User profile |
| `/settings/documents` | JWT | operator | RAG document upload |
| `/settings/general` | JWT | org_admin | Org profile config |
| `/settings/api-keys` | JWT | org_admin | API key management |
| `/settings/members` | JWT | org_admin | Member invite + roles |
| `/settings/webhooks` | JWT | org_admin | Webhook config + deliveries |
| `/settings/integrations` | JWT | org_admin | MCP activity |
| `/admin/login` | No | — | Super admin login |
| `/admin/orgs` | JWT | super_admin | Org management |
| `/admin/orgs/[id]` | JWT | super_admin | Per-org detail + config |
| `/admin/users` | JWT | super_admin | User management |
| `/admin/audit` | JWT | super_admin | Audit log |
| `/admin/apikeys` | JWT | super_admin | Platform API keys |
| `/admin/jobs` | JWT | super_admin | BullMQ job monitor |
| `/forbidden` | JWT | — | 403 via middleware only |
| `/suspended` | JWT | — | Org suspended |

### Zustand Stores

**`authStore`** — `user`, `org`, `isAuthenticated`, `login()`, `logout()`, `refreshToken()`

**`investigationStore`** — `jobId`, `jobStatus` (`idle | connecting | starting | running | completed | failed`), `activityItems[]`, `toolCallCount`, `activityExpanded`

**`mapStore`** — `events[]`, `droneRoutes`, `selectedEvent`, `dateFilter`, map viewport

**`reviewStore`** — current review state, override form values, flag form values

### Key Client Architecture Rules
- `client/src/lib/api.js` axios interceptor unwraps `response.data` once. **Never double-unwrap** in components or `queryFn`.
- All post-auth navigation uses `router.replace()` not `router.push()` — prevents back-button redirect loops.
- 403 interceptor shows toast and lets calling code handle it. Only `code === 'ORG_SUSPENDED'` triggers a redirect.
- Investigate page has **no auto-start**. Shows empty state + "Start Investigation" CTA until user clicks.
- When `investigationStore.jobStatus === 'idle'` and no `jobId`, the Argus Activity column collapses to a 56px rail.

---

## 14. Design System — Night Watch

**Read `client/src/colors_and_type.css` before writing any styling.** These tokens are the law. No hardcoded hex values. No Tailwind color utilities (`bg-gray-*`, `text-slate-*`) in operator-facing pages.

### Color Tokens

```css
/* Surfaces — layered by elevation */
--bg-base:       #07090c;   /* page background */
--bg-surface-1:  #11151c;   /* cards, panels */
--bg-surface-2:  #161b24;   /* section headers, nested panels */
--bg-surface-3:  #1c222d;   /* hover states */

/* Borders */
--border-hairline: #1a2029;  /* subtle dividers */
--border-default:  #232b38;  /* standard borders */
--border-strong:   #334055;  /* emphasized borders */
--border-focus:    #b8d4e8;  /* focus rings ONLY — radar blue */

/* Text — 4 ranks */
--fg-1: #e6ecf3;   /* primary text */
--fg-2: #aab4c2;   /* secondary text */
--fg-3: #6b7686;   /* tertiary, labels */
--fg-4: #434d5c;   /* disabled, placeholders */

/* Severity — the ONLY saturated colors in the system */
--sev-serious:    #ff3838;   /* immediate threat */
--sev-minor:      #e89a2b;   /* needs monitoring */
--sev-harmless:   #7d8a6a;   /* routine / false positive */
--sev-unknown:    #6b7686;   /* insufficient evidence */

/* Accent — radar blue, instrumentation only */
--accent:         #b8d4e8;
--accent-dim:     #5a87a8;

/* Special — briefing document ONLY */
--bg-briefing:    #f4f1ea;   /* paper/light background */
```

### Typography

```css
--font-sans:  'IBM Plex Sans', system-ui, sans-serif;   /* all UI */
--font-serif: 'IBM Plex Serif', Georgia, serif;          /* /briefing ONLY */
--font-mono:  'JetBrains Mono', monospace;               /* timestamps, IDs, labels */

--text-xs:   11px
--text-sm:   13px
--text-base: 14px
--text-md:   15px
--text-lg:   17px
--text-xl:   20px
--text-2xl:  24px
```

### Motion

```css
--ease-out: cubic-bezier(0.2, 0.7, 0.3, 1);
--dur-fast: 120ms;   /* micro-interactions */
--dur-med:  220ms;   /* panel transitions */
```

### The Briefing Exception
`/briefing` page (when rendering a briefing document) uses `--bg-briefing` (light paper) and `--font-serif`. Every other page is dark. Do not mix.

### Severity Icons (lucide-react)
Severity badges carry both color AND icon for accessibility:
- `serious` → `AlertTriangle`
- `minor` → `Circle`
- `harmless` → `CheckCircle`
- `uncertain` → `HelpCircle`

Severity filter pills expose `aria-pressed`. Global `*:focus-visible` uses `--border-focus` outline (defined in `globals.css` — do not remove).

### Layout Templates

**Template A — Fixed 3-column (Investigate page)**
```jsx
<div style={{
  position: 'fixed', top: '56px', left: 0, right: 0, bottom: 0,
  display: 'grid',
  gridTemplateColumns: '360px 1fr 360px',
  gap: '1px',
  background: 'var(--border-default)',
  overflow: 'hidden',
}}>
  <LeftPanel />    {/* Argus activity feed — scrolls internally */}
  <CentrePanel />  {/* Map */}
  <RightPanel />   {/* Events panel — scrolls internally */}
</div>
```

**Template B — Settings / form page (scrollable)**
```jsx
<div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '32px 24px' }}>
  <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xl)',
               fontWeight: 500, color: 'var(--fg-1)', margin: 0 }}>
    Page Title
  </h1>
  <section style={{
    background: 'var(--bg-surface-1)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    marginTop: '24px',
  }}>
    {/* section header + content */}
  </section>
</div>
```

---

## 15. Environment Variables

### Server (`server/.env`)

```bash
# App
NODE_ENV=development           # development | production | test
PORT=8000
CLIENT_URL=http://localhost:3000

# Databases
MONGODB_URL=mongodb://admin:pass@localhost:27017/ridgeway?authSource=admin
REDIS_URL=redis://:pass@localhost:6379          # use rediss:// in production
QDRANT_URL=http://localhost:6333

# Auth
ACCESS_TOKEN_SECRET=<64-char random string>
REFRESH_TOKEN_SECRET=<64-char random string>
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# AI — production (one of the following)
ANTHROPIC_API_KEY=sk-ant-...

# AI — test/dev with LM Studio
USE_LOCAL_LLM=true
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_API_KEY=lm-studio
LOCAL_LLM_MODEL=qwen2.5-7b-instruct
EMBEDDING_BASE_URL=http://localhost:1234/v1
EMBEDDING_MODEL=nomic-embed-text-v1.5

# Webhooks
WEBHOOK_SECRET=<64-char random string>         # HMAC-SHA256 signing key

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@email.com
EMAIL_PASSWORD=app-password
EMAIL_FROM_NAME=Sentinel
EMAIL_FROM_EMAIL=noreply@sentinel.io

# Error monitoring (leave empty to disable)
SENTRY_DSN=

# Logging
LOG_LEVEL=info                                 # trace | debug | info | warn | error

# CORS
CORS_ORIGIN=http://localhost:3000

# Data seeding — NEVER set in production
ALLOW_SEED_DATA=true
```

### Server test env (`server/.env.test`)
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

### Client (`client/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 16. Docker Setup

### Services

| Service | Image | Port(s) | Purpose |
|---|---|---|---|
| `mongodb` | mongo:7.0 | 27017 | Primary database |
| `redis` | redis:7-alpine | 6379 | Cache + BullMQ queues |
| `qdrant` | qdrant/qdrant:latest | 6333, 6334 | Vector search (RAG) |
| `server` | `./server` Dockerfile | 8000 | Express + Bun API |
| `client` | `./client` Dockerfile | 3000 | Next.js frontend |

All services on `ridgeway-network` bridge network.

### Dev
```bash
docker compose up
```

### Prod
```bash
docker compose -f docker-compose.prod.yml up -d
```

Production adds resource limits:

| Service | CPU limit | Memory limit |
|---|---|---|
| MongoDB | 2 | 2GB |
| Redis | 1 | 512MB (+ LRU eviction) |
| Server | 2 | 1GB |
| Client | 1 | 512MB |
| Qdrant | 1 | 1GB |

### Volumes
- `mongodb_data` — database files
- `mongodb_config` — MongoDB config
- `redis_data` — AOF persistence
- `qdrant_data` — vector index storage

### Healthchecks
All services have Docker healthchecks. Server: `curl -f http://localhost:8000/api/v1/health`. Client: `curl -f http://localhost:3000`. DB: `mongosh ping`. Redis: `redis-cli incr ping`.

---

## 17. Development Commands

```bash
# Full stack via Docker
docker compose up

# Server only (Bun watch mode)
cd server && bun run dev

# Server production mode
cd server && bun run start

# Client (Next.js dev, port 3000)
cd client && npm run dev

# Client (stable mode — extra heap for large rebuilds)
cd client && npm run dev:stable

# Client production build
cd client && npm run build

# Lint client
cd client && npm run lint

# Bootstrap first super_admin
cd server && bun run src/scripts/bootstrap-admin.js

# Seed test data (requires ALLOW_SEED_DATA=true, blocked in prod)
cd server && MONGODB_URL=... bun run src/scripts/seedTestData.js

# Clear seed data
cd server && MONGODB_URL=... bun run src/scripts/clearSeedData.js

# Cleanup orphan data — dry run (no orgId rows)
cd server && bun run src/scripts/cleanup-orphan-data.js

# Cleanup orphan data — apply
cd server && bun run src/scripts/cleanup-orphan-data.js --apply

# Migrate review orgId (one-off migration)
cd server && bun run src/scripts/migrate-review-orgId.js
```

---

## 18. Testing

**All tests run against LM Studio — never against Anthropic.** Zero-cost, deterministic, offline-capable.

### LM Studio Setup
1. Install LM Studio, load a tool-calling capable model (e.g. `qwen2.5-7b-instruct`, `llama-3.1-8b-instruct`)
2. Load an embeddings model (`nomic-embed-text-v1.5` or `bge-small-en-v1.5`)
3. Start LM Studio server on port 1234
4. Create `server/.env.test` (see §15)

### Run Tests
```bash
cd server && bun run test:agentic
```

This runs `src/tests/agentic-flow.test.js` — a full end-to-end ReAct loop test:
- Creates synthetic incidents and events in MongoDB (test DB)
- Dispatches Argus investigation against LM Studio
- Validates investigation record: tool calls, evidence chain, classification
- Verifies briefing generation and token usage tracking

---

## 19. Production Deployment

1. Copy `.env.production.example` → configure all required secrets
2. Set `NODE_ENV=production`
3. Set `ANTHROPIC_API_KEY` (do not set `USE_LOCAL_LLM`)
4. Set `WEBHOOK_SECRET` (64-char random)
5. Use `MONGODB_URL` pointing to MongoDB Atlas (enable Encrypted Storage Engine)
6. Use `REDIS_URL` with `rediss://` scheme (TLS) and configure Redis ACLs
7. Set `CORS_ORIGIN` to production client domain
8. Configure Nginx for TLS termination in front of port 3000 and 8000
9. Run: `docker compose -f docker-compose.prod.yml up -d`

### Pre-launch Checklist
- [ ] MongoDB Atlas Encrypted Storage Engine enabled
- [ ] Redis TLS (`rediss://`) + ACLs configured
- [ ] All secrets are 64-char+ random strings
- [ ] `ALLOW_SEED_DATA` is NOT set
- [ ] `SENTRY_DSN` configured for error monitoring
- [ ] `CORS_ORIGIN` locked to production domain
- [ ] `CLIENT_URL` set to production domain
- [ ] Nginx TLS certificates valid
- [ ] Run cleanup-orphan-data.js to verify no null-orgId rows

---

## 20. Roles & Permissions

| Role | Scope | Key capabilities |
|---|---|---|
| `super_admin` | Platform-wide (no orgId) | Admin panel, all orgs, all users, audit logs, BullMQ monitor |
| `org_admin` | Own org | Full settings, API keys, members, webhooks, RAG approval, investigations |
| `operator` | Own org | Overview, investigate, briefing, incidents, RAG upload, read-only settings |

### Settings Page Access

| Page | Minimum role |
|---|---|
| `/settings/documents` | operator |
| `/settings/profile` | operator |
| `/settings/general` | org_admin |
| `/settings/api-keys` | org_admin |
| `/settings/members` | org_admin |
| `/settings/webhooks` | org_admin |
| `/settings/integrations` | org_admin |
| `/admin/*` | super_admin |

### GET /org/me — Reduced Payload for Operators
Operators receive: `_id`, `name`, `status`, `setupComplete`, `config.siteName`, `config.industry`, `config.timezone`, `config.coordinates`. Admin-only fields (`createdBy`, billing, webhookUrl, secrets) are excluded.

---

## 21. Incident Lifecycle

```
open
  └─ investigating   (Argus is running)
       └─ reviewed    (operator has reviewed the Argus output)
            ├─ escalated  (sent to external response team)
            └─ closed     (resolved, no further action)
```

### Severity Classification (set by Argus)

| Severity | Meaning | Recommended operator action |
|---|---|---|
| `serious` | Immediate threat — intruder, fire, active breach | Escalate |
| `minor` | Needs monitoring — repeated badge failures, unknown vehicle | Review |
| `harmless` | Routine — wildlife, known vehicle, sensor false positive | Close |
| `uncertain` | Insufficient evidence to classify | Request follow-up investigation |

---

## 22. Briefing State Machine

The `/briefing` page detects its display state in this priority order:

1. Check `investigationStore` for active `jobId` with `jobStatus` in `['running', 'connecting', 'starting']`
2. Call `GET /api/v1/briefings/latest`
3. Render matching state:

| State | Condition | UI rendered |
|---|---|---|
| **Empty** | No active job AND no briefing exists | "No briefing yet" message + link to /investigate |
| **In progress** | Active `jobId` with running/connecting/starting status | "Argus is completing the investigation…" + live progress |
| **Draft** | Briefing exists, `briefing.status === 'draft'` | Full document + editable sections + Approve button |
| **Approved** | Briefing exists, `briefing.status === 'approved'` | Read-only document + approval timestamp + approver name |

**Critical:** State "In progress" must ONLY render when there is a genuinely active job. The page must never show "0% complete" just because it mounted.

---

## 23. Known Gotchas & Fixed Bugs

### API Response Unwrapping
`client/src/lib/api.js` interceptor unwraps `response.data` once. **Never double-unwrap** in components or queryFn.
```js
// WRONG — interceptor already unwrapped once
const key = data?.data?.key;
const setupComplete = orgData?.data?.setupComplete;

// CORRECT
const key = data?.key;
const setupComplete = orgData?.setupComplete;
```

### Async Callbacks
Any callback using `await` must be declared `async` or it silently fails.
```js
// WRONG — silent failure
onSuccess: (data) => { const org = await getOrgMe(); }

// CORRECT
onSuccess: async (data) => { const org = await getOrgMe(); }
```

### Post-Auth Navigation
Always `router.replace()` after login, register, setup completion, logout. `router.push()` adds to history stack causing back-button redirect loops.

### firstLogin Field
`completeSetup` must call `User.findByIdAndUpdate(req.user._id, { firstLogin: false })` or the welcome banner reappears every session.

### Audit Action Strings
Stable dot-separated identifiers: `'org.setup.complete'`, `'mcp.tool_call'`, `'briefing.approved'`. Do not rename — they are stable database identifiers used as filter keys even during product rebranding.

### Super Admin Setup Gate
super_admin has no `orgId` and must be exempt from the setup redirect. Always check `ridgeway_role` cookie before applying:
```js
const isSuperAdmin = request.cookies.get('ridgeway_role')?.value === 'super_admin';
if (!isSuperAdmin) { /* run setup gate */ }
```

### Logout Clears All Three Cookies
Must clear `ridgeway_auth`, `ridgeway_role`, and `ridgeway_setup`. Missing any one causes session contamination.

### Settings queryFn — Single Unwrap
```js
// WRONG — interceptor unwrapped, then unwrapping again
queryFn: async () => { const res = await api.get('/org/users'); return res.data; }
const members = response?.data || [];

// CORRECT
queryFn: () => api.get('/org/users')
const members = Array.isArray(response) ? response : response?.users ?? [];
```

### Investigate Page — No Auto-Start
The auto-start `useEffect` was removed. The page shows an empty state with a "Start Investigation" button until the user explicitly clicks it. Do not reintroduce auto-start.

### Briefing Page Stuck at 0%
Never render the "in progress" state unless there is a genuinely active `jobId` with status in `['running', 'connecting', 'starting']`. Check `investigationStore` before rendering this state.

### GET /org/me Must Stay Accessible to All Roles
Operators need org name, site name, and `setupComplete` to render `/overview`. Do not restrict this endpoint to org_admin. Returns a reduced payload for operators — no admin-only fields.

### 403 Interceptor Must Not Redirect
The global 403 interceptor in `api.js` shows a toast and lets calling code handle it. A 403 on one background call is not the same as the user landing on a forbidden page. Only `code === 'ORG_SUSPENDED'` triggers a redirect to `/suspended`.

### Canonical Home is /overview
`/dashboard` is a server-side `redirect('/overview')` kept only for backwards compatibility. All post-auth routing, TopBar links, and middleware defaults route to `/overview`. Do not render dashboard content at `/dashboard`.

### Map Data Must Be Org-Scoped
All map endpoints use `req.orgFilter`. No hardcoded coordinates. The London fallback was removed. Map shows an explicit empty state directing the user to configure `org.config.coordinates` in Settings.

### Investigate Column Collapses When Idle
When `jobStatus === 'idle'` and no `jobId`:
- Argus Activity column collapses to 56px rail (vertical "ARGUS" label + call count)
- "Start Investigation" button moves to overlay on the map
- Clicking the rail expands it to show "No Argus activity yet" empty state
- Column auto-expands to 360px when an investigation starts (CSS grid transition)

---

## 24. Naming Reference

| Surface | Use | Never use |
|---|---|---|
| Product name in any user-visible UI | **Sentinel** | Ridgeway |
| AI agent name in user-visible UI copy | **Argus** | "the agent", "Claude", "the assistant" |
| Argus in internal code/files | "agent" is fine | — |
| Webhook headers | `X-Sentinel-*` | `X-Ridgeway-*` |
| Email templates | Sentinel | Ridgeway |
| Git repo / folder name | RidgewaySite (do not rename) | — |
| Audit log action strings | exact stable identifiers | do not rename |

---

## Prerequisites

- **Docker** and **Docker Compose** (recommended path)
- **Bun** (for local server development without Docker)
- **Node.js** 18+ (for local client development without Docker)
- **Anthropic API key** for production AI inference (or LM Studio for local/test)
- **LM Studio** with tool-calling model loaded (for test suite only)

---

## Quick Start

```bash
# 1. Clone
git clone <repository-url>
cd RidgewaySite

# 2. Configure env
cp server/.env.example server/.env
# Edit server/.env — set MONGODB_URL, REDIS_URL, JWT secrets, ANTHROPIC_API_KEY

cp client/.env.local.example client/.env.local
# Edit client/.env.local — set NEXT_PUBLIC_API_URL

# 3. Start
docker compose up

# 4. Bootstrap super admin
cd server && bun run src/scripts/bootstrap-admin.js

# 5. Open http://localhost:3000
```

---

*Last updated: 2026-05-17*
*License: ISC*
