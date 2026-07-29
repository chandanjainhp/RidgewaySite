# Sentinel

Sentinel helps your team understand what happened overnight at an industrial site. Drones and sensors record activity while you sleep; in the morning you open Sentinel, review what Argus (the built-in AI analyst) found, and approve a briefing to share with your day shift.

---

## Setup

1. **Install Docker Desktop** on your computer and make sure it is running.

2. **Copy the environment files**
   - Copy `server/.env.example` to `server/.env`
   - Copy `client/.env.example` to `client/.env`
   - Leave the default values unless your IT team gives you different database or API settings.

3. **Start MongoDB + Redis only** (from the project folder):
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```
   This does **not** start the API or UI. Server and client run on your machine so hot-reload and LM Studio stay simple. The root `docker-compose.yml` is the Raspberry Pi / Cloudflare production stack (see below).

4. **Start Sentinel** — in two terminals:
   ```bash
   cd server && bun run dev
   ```
   ```bash
   cd client && npm run dev
   ```

5. **Open your browser** at [http://localhost:3000](http://localhost:3000).

6. **Log in** with the admin account your installer created (for a fresh test install, ask whoever ran the bootstrap script for the email and password).

---

## Running on Raspberry Pi 5 via Cloudflare Tunnel

Expose Sentinel on a Pi 5 (arm64) **without port forwarding**: Cloudflare Tunnel (`cloudflared`) dials out; Compose never publishes host ports.

### One-time prep on the Pi

1. Clone this repo onto the Pi (or sync it onto an OMV share).
2. Create NAS-backed data dirs (default path used by compose bind mounts):
   ```bash
   sudo mkdir -p /srv/sentinel/{mongodb,redis}
   sudo chown -R 999:999 /srv/sentinel/mongodb /srv/sentinel/redis
   ```
   If your OpenMediaVault disk is under `/srv/dev-disk-by-uuid-…/`, either symlink that folder to `/srv/sentinel` or set `SENTINEL_DATA_ROOT` in `.env`.
3. Copy env and fill secrets:
   ```bash
   cp .env.example .env
   ```
   Set at least: `CLOUDFLARE_TUNNEL_TOKEN`, `CLIENT_URL` / `CORS_ORIGIN` (your public `https://…` hostname), Mongo/Redis passwords, JWT secrets, and `ANTHROPIC_API_KEY` if Argus will call Claude.
4. In **Cloudflare Zero Trust → Networks → Tunnels**: create a tunnel, copy the token into `.env` as `CLOUDFLARE_TUNNEL_TOKEN`. Add a **Public Hostname**:
   - Hostname: `yourdomain.com` (or `app.yourdomain.com`)
   - Service / URL: `http://client:3000`  
     Use the Compose service name `client`, not `localhost` — `cloudflared` shares the `sentinel` bridge network.

**Single hostname is enough.** The Next.js client rewrites `/api/v1/*` to `http://server:8000` inside Docker (`API_UPSTREAM_URL`). You do **not** need a separate `api.yourdomain.com` route unless you want external systems to hit the API without going through the UI.

### Start the stack

```bash
docker compose up -d --build
docker compose ps
```

Confirm health (all of `mongodb`, `redis`, `server`, `client` should be healthy; `cloudflared` should be running):

```bash
docker compose ps
curl -fsS https://yourdomain.com/api/v1/health
```

From the public internet, open `https://yourdomain.com` — you should get the Sentinel UI. API calls from the browser stay on that same origin.

### Notes

- Image tags used (`mongo:7.0`, `redis:7-alpine`, `oven/bun:1-slim`, `node:20-alpine`, `cloudflare/cloudflared:latest`) publish **linux/arm64** manifests (verified via Docker Hub).
- Compose memory limits assume an **8GB** Pi 5. On a **16GB** board you can raise `server` / `mongodb` / `client` limits in `docker-compose.yml` — say if you want a tuned overlay.
- Tunnel token and live reachability require your Cloudflare account; those steps cannot be verified from the repo alone.

---

## How to use it

### Morning — Overview

After you log in, **Overview** is your starting point. It shows how many incidents were recorded last night and whether your morning briefing is ready.

- If incidents are listed, click one to open its details.
- If Argus has finished investigating, you will see a **Review briefing** button.

### Incidents workspace

Open **Incidents** to see everything from the patrol night in one place.

- Use the **Priority** and **Severity** filters to focus on what matters.
- Click a row to see details in the side panel.
- The **site map** below the table shows where events were detected.
- When you are ready, start the investigation so Argus can analyse overnight events.

### Morning briefing

Open **Briefing** to read Argus's draft summary of the night.

- Review each section (what happened, cleared items, escalations, drone findings, follow-ups).
- Edit any section if you need to adjust the wording.
- Click **Approve briefing** when you are satisfied — this locks the document for the 8:00 AM handover.

---

## Where to get help

File issues and questions in your project's issue tracker (GitHub or internal forge). For developer and architecture documentation, see [`docs/technical/`](docs/technical/).
