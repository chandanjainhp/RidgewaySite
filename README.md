# Ridgeway Site - Overnight Intelligence Platform

AI-first intelligence platform that transforms fragmented overnight operational signals into a validated morning briefing for industrial site operators.

## Overview

Ridgeway Site is a full-stack, multi-tenant platform that processes overnight sensor events and incidents, runs AI-driven investigations, and delivers structured morning briefings. It supports Role-Based Access Control (RBAC), RAG-powered document intelligence, a Model Context Protocol (MCP) server for AI agent integration, and a full webhook/audit system.

---

## Authentication Flows

JWT-based authentication with OTP verification:

- **Registration**: User registers → receives OTP via email → verifies to activate account
- **Login**: Email + password → JWT access token (cookie) + refresh token
- **Forgot Password**: Request reset → OTP via email → set new password
- **Session Management**: Short-lived access tokens + long-lived refresh tokens via secure cookies

---

## Role-Based Access Control (RBAC)

| Role | Scope | Permissions |
|------|-------|-------------|
| `super_admin` | Platform-wide | Full admin panel, manage all orgs and users |
| `org_admin` | Organisation | Manage members, API keys, webhooks, approve RAG documents |
| `operator` | Organisation | View data, upload RAG documents, run investigations |

All data is scoped to the authenticated user's organisation — cross-org data access is blocked at middleware level.

---

## Tech Stack

### Client (Frontend)
- **Framework**: Next.js 16 (React 19)
- **Styling**: Tailwind CSS 4, Radix UI Primitives
- **State Management**: Zustand, React Query (@tanstack/react-query)
- **Forms & Validation**: React Hook Form, Zod
- **Data Visualisation & Maps**: Recharts, Leaflet, React Three Fiber (3D)
- **Animations**: Framer Motion

### Server (Backend)
- **Runtime**: Node.js (via Bun)
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Vector Database**: Qdrant (for RAG document embeddings)
- **Cache & Queue**: Redis, BullMQ (asynchronous background jobs)
- **AI Integration**: Anthropic AI SDK (Claude), OpenRouter, LM Studio (local models via OpenAI-compatible API), OpenAI SDK (embeddings)
- **MCP**: `@modelcontextprotocol/sdk` — SSE-based MCP server for AI agent tool access
- **Authentication**: JWT (access + refresh), bcrypt, API key auth
- **Emails**: Nodemailer, Mailgen
- **Observability**: Pino (structured logging), Sentry

### Infrastructure & Deployment
- **Containerisation**: Docker & Docker Compose
- **Environments**: Development (`docker-compose.yml`) & Production (`docker-compose.prod.yml`)
- **Services**: MongoDB 7, Redis 7, Qdrant (latest)

---

## Project Structure

```text
RidgewaySite/
├── client/                         # Next.js frontend application
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/              # Super-admin panel (org/user/job management)
│   │   │   ├── briefing/           # Morning briefing view
│   │   │   ├── dashboard/          # Main operational dashboard
│   │   │   ├── incident/           # Incident detail view
│   │   │   ├── investigate/        # AI investigation runner
│   │   │   ├── settings/
│   │   │   │   ├── api-keys/       # Org API key management
│   │   │   │   ├── documents/      # RAG document upload & review
│   │   │   │   ├── general/        # Org profile config
│   │   │   │   ├── integrations/   # MCP integration settings
│   │   │   │   ├── members/        # Member invite & management
│   │   │   │   └── webhooks/       # Webhook config & deliveries
│   │   │   └── ...auth pages
│   │   ├── components/
│   │   └── lib/
│   ├── package.json
│   └── Dockerfile
├── server/                         # Express backend
│   ├── src/
│   │   ├── ai/                     # Claude agent & AI utilities
│   │   ├── config/                 # Qdrant client & collection setup
│   │   ├── controllers/            # Route handlers
│   │   ├── db/                     # MongoDB + Redis connection
│   │   ├── mcp/                    # MCP server definition & tools
│   │   ├── middlewares/            # Auth, rate limiting, error handling
│   │   ├── models/                 # Mongoose schemas
│   │   ├── queues/                 # BullMQ queue definitions
│   │   ├── routes/                 # Express routers
│   │   ├── services/               # Embedding, webhook, email services
│   │   ├── scripts/                # One-off scripts (seedTestData.js)
│   │   ├── tools/                  # MCP tool implementations
│   │   ├── utils/                  # Logger, async handler, helpers
│   │   └── validators/             # Zod/Joi validators
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml              # Development stack
├── docker-compose.prod.yml         # Production stack
├── .env.production.example         # Environment variable reference
└── AUDIT.md                        # Security audit log
```

---

## Prerequisites

- **Docker** and **Docker Compose**
- **Node.js** (v18+)
- **Bun** (for local server development)
- **OpenAI API key** (or compatible LM Studio / OpenRouter endpoint) for embeddings and/or AI inference

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd RidgewaySite
```

### 2. Environment Setup

Copy `.env.production.example` to `.env` and configure:

```env
# MongoDB
MONGODB_URL=mongodb://admin:password123@localhost:27017/ridgeway?authSource=admin

# Redis
REDIS_URL=redis://:password123@localhost:6379

# JWT
JWT_SECRET=your-jwt-secret-change-in-production

# Emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# AI Provider — set ONE of the following three blocks:

# Option A: Anthropic Claude (default)
ANTHROPIC_API_KEY=sk-ant-...

# Option B: OpenRouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3-sonnet   # optional, defaults to claude-3-sonnet

# Option C: LM Studio (local model, OpenAI-compatible)
OPENAI_BASE_URL=http://localhost:1234/v1     # set this to activate LM Studio provider
LMSTUDIO_MODEL=openai/gpt-oss-20b           # model identifier served by LM Studio
LMSTUDIO_MAX_TOKENS=800                     # optional cap on output tokens (default 800)

# Embeddings (used by all providers for RAG)
OPENAI_API_KEY=your-openai-key             # or "lm-studio" when using LM Studio
EMBEDDING_MODEL=text-embedding-3-small     # or your local model name

# Qdrant
QDRANT_URL=http://localhost:6333

# CORS
CORS_ORIGIN=http://localhost:3000

# Client (Next.js)
NEXT_PUBLIC_SUPPORT_EMAIL=support@ridgeway.io

# Sentry (optional)
SENTRY_DSN=
```

### 3. Running with Docker (Recommended)

Starts the full stack: Client, Server, MongoDB, Redis, Qdrant.

**Development:**
```bash
docker-compose up -d --build
```

| Service | URL |
|---------|-----|
| Client | http://localhost:3000 |
| Server API | http://localhost:8000 |
| MongoDB | localhost:27017 |
| Redis | localhost:6379 |
| Qdrant | http://localhost:6333 |

**Production:**
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### 4. Running Locally (Without Docker)

**Server:**
```bash
cd server
bun install
bun run dev
```

**Client:**
```bash
cd client
npm install
npm run dev
```

> Qdrant must still be running. Start it separately:
> ```bash
> docker run -p 6333:6333 qdrant/qdrant
> ```

---

## API Endpoints

All routes are prefixed with `/api/v1`. Auth-protected routes require a valid JWT (cookie or `Authorization: Bearer`) or an org API key where noted.

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Service health check |

### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register new user |
| POST | `/auth/login` | — | Login |
| POST | `/auth/verify-email` | — | Verify email via OTP |
| POST | `/auth/refresh-token` | — | Refresh access token |
| POST | `/auth/forgot-password` | — | Request password reset OTP |
| POST | `/auth/reset-password` | — | Reset password with OTP |
| POST | `/auth/logout` | JWT | Logout |
| GET | `/auth/current-user` | JWT | Get current user profile |
| POST | `/auth/change-password` | JWT | Change password |
| POST | `/auth/resend-email-verification` | JWT | Resend verification OTP |

### Events
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/events` | JWT | Get events for a specific night |
| GET | `/events/:id` | JWT | Get event detail |
| PATCH | `/events/:id/review` | JWT | Apply AI review to an event |

### Incidents
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/incidents` | JWT | List incidents (filter by night, status, severity) |
| GET | `/incidents/:id` | JWT | Get incident detail |
| GET | `/incidents/:id/graph` | JWT | Get evidence graph for visualisation |

### Investigations
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/investigations/start` | JWT | Start AI-driven investigation |
| GET | `/investigations/:jobId/stream` | JWT | Stream investigation progress (SSE) |
| GET | `/investigations/:id` | JWT | Get investigation detail |

### Briefings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/briefings/latest` | JWT | Get latest morning briefing |
| PATCH | `/briefings/:id/sections/:sectionName` | JWT | Update a briefing section |
| POST | `/briefings/:id/approve` | JWT | Approve a briefing |

### Reviews
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/reviews` | JWT | Create a manual review for an event |
| GET | `/reviews/night/:date` | JWT | Get all reviews for a specific night |

### Map & Drones
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/map/geometry` | JWT | Get map geometry data |
| GET | `/map/events` | JWT | Get map event pins |
| GET | `/map/drones/route/:patrolId` | JWT | Get drone patrol route |
| GET | `/map/drones/:patrolId/state` | JWT | Get current drone state |
| POST | `/map/drones/simulate-mission` | JWT | Simulate a drone mission |

### Organisation (`/org`) — `org_admin` or `super_admin`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/org/me` | JWT (org_admin+) | Get org profile |
| PATCH | `/org/me/config` | JWT (org_admin+) | Update org config |
| POST | `/org/users/invite` | JWT (org_admin+) | Invite a new operator |
| GET | `/org/users` | JWT (org_admin+) | List org members |
| GET | `/org/api-keys` | JWT (org_admin+) | List org API keys |
| POST | `/org/api-keys` | JWT (org_admin+) | Create org API key |
| DELETE | `/org/api-keys/:keyId` | JWT (org_admin+) | Revoke an API key |
| GET | `/org/webhooks/config` | JWT (org_admin+) | Get webhook config |
| PUT | `/org/webhooks/config` | JWT (org_admin+) | Update webhook config |
| POST | `/org/webhooks/rotate-secret` | JWT (org_admin+) | Rotate webhook signing secret |
| GET | `/org/webhooks/deliveries` | JWT (org_admin+) | List webhook deliveries |
| POST | `/org/webhooks/test` | JWT (org_admin+) | Send a test webhook |
| POST | `/org/webhooks/deliveries/:deliveryId/retry` | JWT (org_admin+) | Retry a failed delivery |
| GET | `/org/mcp/activity` | JWT (org_admin+) | Get MCP tool call activity log |

### RAG Documents (`/org/documents`) — all org members
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/org/documents/upload` | JWT (operator+) | Upload a document for RAG indexing |
| GET | `/org/documents` | JWT (operator+) | List org documents |
| GET | `/org/documents/:docId` | JWT (operator+) | Get document detail |
| DELETE | `/org/documents/:docId` | JWT (operator+) | Delete a document |
| POST | `/org/documents/:docId/approve` | JWT (org_admin+) | Approve document for RAG use |
| POST | `/org/documents/:docId/reject` | JWT (org_admin+) | Reject a document |

### MCP Server (`/mcp`) — API key required with `mcp` scope
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/mcp` | API Key | Establish SSE connection for MCP protocol |
| POST | `/mcp/messages?sessionId=` | API Key | Send MCP JSON-RPC messages (60 tool calls/min limit) |

### Admin (`/admin`) — `super_admin` only
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/orgs` | List all organisations |
| POST | `/admin/orgs` | Create a new organisation |
| GET | `/admin/orgs/:orgId` | Get org detail |
| PATCH | `/admin/orgs/:orgId/status` | Suspend/activate org |
| PATCH | `/admin/orgs/:orgId/config` | Update org config |
| POST | `/admin/orgs/:orgId/invite` | Invite org admin |
| POST | `/admin/orgs/:orgId/resend-invite/:userId` | Resend invite |
| GET | `/admin/users` | List all users |
| PATCH | `/admin/users/:userId/role` | Change user role |
| POST | `/admin/users/:userId/force-logout` | Force logout a user |
| PATCH | `/admin/users/:userId/status` | Suspend/activate user |
| GET | `/admin/apikeys` | List all API keys |
| DELETE | `/admin/apikeys/:keyId/revoke` | Revoke any API key |
| GET | `/admin/jobs/stats` | Get BullMQ queue statistics |
| GET | `/admin/jobs/failed` | List failed jobs |
| POST | `/admin/jobs/:queueName/:jobId/retry` | Retry a failed job |
| DELETE | `/admin/jobs/:queueName/:jobId` | Delete a job |
| GET | `/admin/audit` | Get system audit logs |

---

## RAG Document Intelligence

Uploaded documents are chunked, embedded via OpenAI (or any compatible local model via `OPENAI_BASE_URL`), and stored in Qdrant with org-scoped filtering. Documents require `org_admin` approval before they become available to AI tools.

**Flow:**
1. Operator uploads PDF/text via `POST /org/documents/upload`
2. Server chunks, embeds, and stores vectors in Qdrant collection `ridgeway_documents`
3. `org_admin` approves via `POST /org/documents/:docId/approve`
4. Claude agents and MCP tools can now query the document corpus scoped to the org

---

## MCP Integration

The platform exposes a Model Context Protocol (MCP) server at `/api/v1/mcp`. AI agents can connect via SSE and call tools scoped to an organisation using an API key with `mcp` scope.

**Rate limit:** 60 tool calls per minute per API key.

**To connect:**
1. Create an API key in Settings → API Keys (select `mcp` scope)
2. Use the key as `Authorization: Bearer <key>` when connecting to `/api/v1/mcp`
3. MCP activity is visible in Settings → Integrations

---

## Scripts

### Server
```bash
bun run dev    # Development/watch mode
bun run start  # Production mode
```

**Seed test data** (populates MongoDB with sample org, users, events, incidents, and a briefing):
```bash
cd server
MONGODB_URL=mongodb://... bun run src/scripts/seedTestData.js
```

### Client
```bash
npm run dev    # Next.js dev server
npm run build  # Production build
npm run start  # Production server
npm run lint   # ESLint
```

---

## License

ISC License
