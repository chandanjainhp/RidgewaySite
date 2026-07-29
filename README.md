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
   docker compose up -d
   ```
   This does **not** start the API or UI. Server and client run on your machine so hot-reload and LM Studio stay simple. Production-style app containers live in the Dockerfiles under `server/` and `client/` — use those only if you are packaging a deploy, not for day-to-day development.

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
