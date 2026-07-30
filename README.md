# Sentinel

**Sentinel** turns overnight drone and sensor activity on an industrial site into a morning briefing operators can review and approve.

**Argus** is the built-in AI analyst. **Night Watch** is the UI design language.

> The git folder is still named `RidgewaySite` for history — do not rename it. In the product UI and docs, always say **Sentinel** / **Argus**.

---

## How it works

```
NIGHT        Drones/sensors post events → POST /api/v1/events (ingestion secret)
OVERNIGHT    Workers correlate events into incidents; Argus investigates & drafts a briefing
MORNING      Operator opens /overview → reviews /incidents → approves /briefing → webhook fires
```

---

## Stack

| Layer | Tech |
|---|---|
| Client | Next.js 16, React 19, Tailwind 4, Zustand, React Query |
| Server | Express on Bun, BullMQ workers |
| Data | MongoDB 7, Redis 7 |
| AI (prod) | Anthropic Claude |
| AI (local/test) | LM Studio (`USE_LOCAL_LLM=true`) |
| Auth | JWT in httpOnly cookies + bcrypt |
| Design | Night Watch tokens (`client/src/colors_and_type.css`) |

| Service | Port |
|---|---|
| Client | 3000 |
| API | 8000 |
| MongoDB | 27017 |
| Redis | 6379 |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (Compose v2)
- [Bun](https://bun.sh) (server)
- Node.js 20+ (client — `npm`)
- Optional for local Argus: [LM Studio](https://lmstudio.ai) on `localhost:1234`

---

## Local development

Day-to-day: **Mongo + Redis in Docker**, **API and UI on the host** (hot reload, easy LM Studio).

### 1. Clone and env files

```bash
git clone <repo-url> RidgewaySite
cd RidgewaySite

cp server/.env.example server/.env
cp client/.env.example client/.env
```

Point `server/.env` at the local Compose data plane (credentials match `server/docker-compose.local.yml`):

```bash
MONGODB_URL=mongodb://admin:StrongMongoPass%40123@localhost:27017/ridgeway?authSource=admin
REDIS_URL=redis://:StrongRedisPass%40123@localhost:6379
CLIENT_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

For local Argus without Anthropic cost, also set:

```bash
USE_LOCAL_LLM=true
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_API_KEY=lm-studio
LOCAL_LLM_MODEL=<your-loaded-chat-model>
```

`client/.env` can keep:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

(The browser still calls same-origin `/api/v1`; Next rewrites that to the API.)

### 2. Start MongoDB + Redis

```bash
docker compose -f docker-compose.dev.yml up -d
```

This does **not** start the API or UI. Production full-stack Compose is the root `docker-compose.yml` (Pi / Cloudflare — see below).

### 3. Bootstrap admin + site (first time)

Creates a Site singleton, prints an **ingestion secret** once, and a `super_admin` user. **Wipes all Mongo collections.**

```bash
cd server
MONGODB_URL='mongodb://admin:StrongMongoPass%40123@localhost:27017/ridgeway?authSource=admin' \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='changeme-at-least-8' \
WIPE_ALL=true \
bun run src/scripts/bootstrap-admin.js
```

Store the printed ingestion secret — drones use it as `Authorization: Bearer <secret>` on `POST /api/v1/events`.

### 4. Run API and UI

```bash
# terminal 1
cd server && bun run dev

# terminal 2
cd client && npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the bootstrap email/password.

### Useful commands

```bash
cd server && bun run dev          # API watch mode
cd client && npm run dev          # UI on :3000
cd server && bun test             # unit tests
cd server && bun run test:agentic # agent flow (needs LM Studio)
```

Optional seed data (dev only; blocked in production):

```bash
cd server && ALLOW_SEED_DATA=true bun run src/scripts/seedTestData.js
```

---

## Using the product

| Route | Purpose |
|---|---|
| `/` | Public landing |
| `/login` | Sign in |
| `/overview` | Morning hub — overnight summary |
| `/incidents` | Incident list, filters, map, start investigation |
| `/incident/[id]` | Incident detail / case file |
| `/investigate` | Argus investigation runner (map + activity) |
| `/briefing` | Draft / approve morning briefing |
| `/docs` | In-app documentation |
| `/settings/general` | Site profile / map coordinates |
| `/settings/api-keys` | Ingestion secret rotation (admin) |
| `/settings/webhooks` | Outbound webhook URL (admin) |
| `/profile` | Account / password |
| `/admin/*` | Super-admin panel |

Primary nav: **Overview → Incidents → Briefing → Docs**.

Typical morning:

1. Open **Overview** — see overnight counts and briefing status.
2. Open **Incidents** — filter by severity, inspect the map, start Argus if needed.
3. Open **Briefing** — review Argus’s draft, edit sections, **Approve** (fires signed webhook when configured).

Briefing UI states: empty → investigation in progress → draft → approved.

---

## Event ingestion

```http
POST /api/v1/events
Authorization: Bearer <ingestion-secret>
Content-Type: application/json
```

```json
{
  "type": "motion_detected",
  "timestamp": "2026-04-16T02:34:15.000Z",
  "location": {
    "name": "North Gate",
    "zone": "perimeter",
    "coordinates": { "lat": 51.5074, "lng": -0.1278 }
  },
  "severity": "minor",
  "rawData": {}
}
```

Supported `type` values include `motion_detected`, `badge_swipe_fail`, `vehicle_entry`, `fence_alert`, `environmental`. Severity: `serious` | `minor` | `harmless`.

Rotate the secret from **Settings → API keys** (shown once).

---

## Project layout

```
RidgewaySite/
├── client/                 # Next.js app (Night Watch UI)
├── server/                 # Express/Bun API + Argus + workers
│   ├── src/ai/             # Argus agent, LLM client, tools
│   ├── src/queues/         # BullMQ correlation / investigation / webhooks
│   ├── src/scripts/        # bootstrap-admin, seed, migrations
│   └── Dockerfile          # Production API image (Bun, arm64-ready)
├── docs/technical/         # Architecture, CLAUDE.md, HANDOFF, audits
├── docker-compose.dev.yml  # Local Mongo + Redis only
├── docker-compose.yml      # Pi 5 production: mongo, redis, server, client, cloudflared
├── .env.example            # Root env for Pi / Cloudflare deploy
└── README.md               # ← you are here
```

---

## Running on Raspberry Pi 5 via Cloudflare Tunnel

Full stack on one arm64 Pi, **no port forwarding** — Cloudflare Tunnel dials out. Compose does not publish host ports.

### Prep

```bash
cp .env.example .env
# Fill: CLOUDFLARE_TUNNEL_TOKEN, CLIENT_URL, CORS_ORIGIN,
# Mongo/Redis passwords, JWT secrets, ANTHROPIC_API_KEY
```

MongoDB and Redis persist in Docker-managed named volumes (`mongodb_data`, `redis_data` — see `docker volume ls`). No host path bind mounts.

### Cloudflare

1. Zero Trust → **Networks → Tunnels** → create tunnel → copy token → `CLOUDFLARE_TUNNEL_TOKEN`.
2. Public hostname → service **`http://client:3000`** (Compose service name, not `localhost`).

**One hostname is enough.** Next rewrites `/api/v1/*` to `http://server:8000` on the Docker network (`API_UPSTREAM_URL`). No separate `api.*` route required.

### Start

```bash
docker compose up -d --build
docker compose ps
curl -fsS https://yourdomain.com/api/v1/health
```

Images used (`mongo:7.0`, `redis:7-alpine`, `oven/bun:1-slim`, `node:20-alpine`, `cloudflare/cloudflared:latest`) publish **linux/arm64** manifests. Memory limits assume an **8GB** Pi 5; raise them on 16GB if needed.

After first boot, run bootstrap against the running Mongo container (or exec into the network) the same way as local, then open your public URL.

---

## Roles (current)

| Role | Access |
|---|---|
| `super_admin` | Full app + `/admin` |
| `org_admin` | Site settings (API keys, webhooks), operator surfaces |
| Operator-style users | Overview, incidents, briefing, docs, profile, site general (read/map) |

The product is oriented around a **single Site** document (singleton), not a multi-org signup wizard.

---

## Documentation

| Doc | Audience |
|---|---|
| [docs/technical/DEVELOPER.md](docs/technical/DEVELOPER.md) | Full architecture & API |
| [docs/technical/CLAUDE.md](docs/technical/CLAUDE.md) | Conventions, design tokens, known bugs |
| [docs/technical/HANDOFF.md](docs/technical/HANDOFF.md) | Build plan / waves |
| [docs/technical/MDfile/AUDIT.md](docs/technical/MDfile/AUDIT.md) | Security & feature audit |
| In-app `/docs` | Operators |

---

## Naming cheat sheet

| Use | Avoid (in user-facing copy) |
|---|---|
| Sentinel | Ridgeway |
| Argus | “the agent”, Claude |
| `X-Sentinel-*` webhook headers | `X-Ridgeway-*` |

Internal code paths and the repo folder name may still say Ridgeway — that is intentional.

---

## Help

Open issues on the project tracker. For deeper engineering context, start with [`docs/technical/`](docs/technical/).
