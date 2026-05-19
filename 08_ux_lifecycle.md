# UX Phase 3 — Lifecycle and history

**Goal.** Make the product usable past day 1. Surface what changes silently (webhook failures, agent errors, pending approvals). Make the product's historical record (yesterday's incidents, last week's briefings) discoverable. Unify the status vocabulary visible to the user.

**Read first:** `CLAUDE.md` §21, §22, all `client/src/app/briefing/`, `client/src/app/incident/`, `server/src/models/auditLog.model.js`, `server/src/models/webhookDelivery.model.js`.

---

## 3A — Notification center (4 days)

**Problem.** Webhook failures, unreviewed serious incidents, agent errors, pending RAG approvals, member invite delivery failures — all invisible until the user navigates to the exact deep settings table that surfaces them. A bell in the TopBar (placeholder added in UX Phase 2A) needs to actually do something.

**Sources of notifications:**

| Type | Trigger | Audience |
|---|---|---|
| `incident.serious_unreviewed` | Serious incident exists for > 1h without review | operator |
| `briefing.failed` | Briefing generation failed | operator, org_admin |
| `briefing.ready` | Briefing transitioned to `draft` | operator |
| `webhook.delivery_failed` | Webhook permanently failed after 5 attempts | org_admin |
| `rag.pending_approval` | Document uploaded, awaits approval | org_admin |
| `argus.errored` | Investigation entered `failed` status | operator, org_admin |
| `member.invite_bounced` | Email to invited member returned hard bounce | org_admin |
| `org.api_key_expiring` | API key expires in < 7 days | org_admin |

**Schema:**

`server/src/models/notification.model.js`:
```js
{
  orgId: ObjectId,
  userId: ObjectId?,                     // null = org-wide (any matching role sees it)
  audienceRole: String?,                 // 'operator', 'org_admin' — filter when userId null
  type: String,                          // enum from table above
  severity: { type: String, enum: ['info', 'warning', 'critical'] },
  title: String,
  body: String,
  link: String,                          // route to navigate to
  metadata: Mixed,
  readBy: [ObjectId],                    // userIds who marked read
  dismissedBy: [ObjectId],
  createdAt: Date,
}
// Indexes: { orgId, createdAt: -1 }, { orgId, dismissedBy }
```

**Emitter pattern:**

`server/src/services/notification.service.js`:
- `createNotification({ orgId, type, severity, title, body, link, ... })`
- Called from: the outbox poller (webhook failures), `worker.js` on investigation failure, briefing service on state transitions, the periodic "unreviewed incidents" job, etc.
- Dedupe: if a notification of the same `(orgId, type, metadata.resourceId)` exists in the last hour, skip. Don't spam.

**API:**

- `GET /notifications` — JWT. Returns unread + unresolved for the current user. Query: `limit`, `cursor`.
- `POST /notifications/:id/read` — mark read.
- `POST /notifications/:id/dismiss` — dismiss.
- `POST /notifications/mark-all-read`.

**Client:**

1. TopBar bell badge count: unread count (capped at 99+).
2. Click → dropdown panel showing latest 20 unread + last 5 read. Each item:
   - Severity color stripe on the left
   - Title (bold, `--fg-1`)
   - Body (one line, `--fg-2`)
   - Relative time, mono `--fg-3`
   - Click → navigates via `link`, marks read
3. "View all" link → full `/notifications` page (table view with filters).
4. Polling: every 30s while the tab is visible. Don't poll when hidden.
5. Mobile: bell stays in the TopBar; click opens a full-screen drawer instead of dropdown.

**Acceptance:**
- Force a webhook to fail permanently. Within 30s, the org_admin sees a bell badge increment, the notification appears with link to `/settings/webhooks`.
- Approve an investigation that crashes. Operator sees the failure notification within 30s.

---

## 3B — History navigation (3 days)

**Problem.** Yesterday's briefing is reachable. Two-weeks-ago Tuesday is not. The product produces a daily artifact and has no archive UI.

**Action — three places:**

1. **`/briefing` archive view.**
   - Add a date picker in the page header (defaults to last night).
   - Past briefings render read-only with approval metadata, regardless of current state.
   - Add `GET /briefings` with query `?startDate=&endDate=&status=&limit=`. List archived briefings as a sidebar/drawer accessible from the date picker; click a date → loads that briefing.
2. **`/incidents` date range.**
   - Date picker supports single date and range.
   - Filter persists in URL query (`?startDate=2026-05-10&endDate=2026-05-17&severity=serious`).
   - Filter pills above the table show active filters; click X to clear.
3. **`/overview` "Recent" rail.**
   - On the right rail of `/overview`, add a "Recent nights" section: last 7 days, each row showing date + incident count + briefing status. Click → loads that night's briefing.

**Calendar component:**

Reusable `client/src/components/shared/DatePicker.jsx`:
- Single date and range modes.
- Shows incident-count heatmap dots on dates with activity (subtle, secondary visual).
- Highlights `serious`-incident dates with `--sev-serious` dot.
- Keyboard navigable (arrow keys, Enter, Esc).

**Acceptance:**
- An operator can navigate to "2 weeks ago Tuesday's briefing" in three clicks from `/overview`.
- The `/incidents` URL with filters can be bookmarked and shared with another team member; opening the URL restores the filtered view.

---

## 3C — Unify visible status vocabulary (2 days)

**Problem.** Different pages use different status words for the same concept. Agent stream emits `tool_called/reasoning/classification`. Investigation status is `queued/running/complete/failed`. Briefing is `generating/draft/approved/failed`. Incident is `open/investigating/reviewed/escalated/closed`. The user sees four vocabularies depending on the page.

This is partly resolved by the schema reconciliation work (Phase 2 of architecture). UX phase enforces the **user-facing** strings.

**Decision: each lifecycle has its own vocabulary because they describe different things. But every status word in the UI follows these rules:**

1. **Use the canonical word verbatim.** No "in progress" when the data says `running`. No "ready" when the data says `draft`.
2. **Status pills look identical across pages.** Same component, same height (20px), same padding, same font (mono 10px uppercase tracked 0.1em), same border radius (2px).
3. **One color per status, used consistently across all pages:**

| Lifecycle | Status | Color token | Visual |
|---|---|---|---|
| Incident | `open` | `--sev-minor` | amber pill |
| Incident | `investigating` | `--accent` | cyan pill (accent indicates "system is working") |
| Incident | `reviewed` | `--fg-3` | neutral pill |
| Incident | `escalated` | `--sev-serious` | red pill |
| Incident | `closed` | `--fg-4` | dim neutral pill |
| Investigation | `queued` | `--fg-3` | neutral |
| Investigation | `running` | `--accent` | cyan |
| Investigation | `complete` | `--sev-harmless` | recede |
| Investigation | `failed` | `--sev-serious` | red |
| Briefing | `generating` | `--accent` | cyan |
| Briefing | `draft` | `--sev-minor` | amber (action needed) |
| Briefing | `approved` | `--sev-harmless` | recede |
| Briefing | `failed` | `--sev-serious` | red |

**Action:**
1. Single `<StatusPill kind="incident" status="open" />` component. Internally maps to the color + label. No inline status rendering anywhere.
2. Migrate every status rendering across the client to use it.
3. Audit all "tagless" status strings in the UI ("In progress", "Pending review", "Locked", etc.) and replace with the canonical word.
4. Update strings in alerts and toasts to use canonical words ("Investigation complete" not "Investigation finished").

**Acceptance:**
- `grep -r 'in progress\|pending review\|finished\|ready\|locked' client/src/app/` returns no matches except in legitimate prose contexts.
- Every status pill across the app is visually identical in dimensions and color logic.

---

## 3D — Empty states with guidance (1 day)

**Problem.** "No investigation running for 2026-05-17. [Start investigation]" is a fact, not guidance. After Phase 1 auto-starts investigations, the operator only sees these empty states when something unusual is happening. The copy must explain *why* it's empty.

**Rewrite empty states across the app:**

| Page | Old | New |
|---|---|---|
| `/overview` (no events yet) | "No data yet." | "The site is quiet — no events ingested for tonight. Argus will begin reporting once the first sensor data arrives." |
| `/overview` (no incidents) | "No incidents." | "Argus correlated 142 events and found no incidents. Recent activity matched normal patterns." |
| `/incidents` (filtered to zero) | "No results." | "No incidents match this filter. Try expanding the date range or clearing severity filter." |
| `/incident/[id]/evidence` (no chain) | "No evidence." | "Argus has not yet generated evidence for this incident. If the investigation is queued, this section will populate when complete." |
| `/briefing` (no record) | "No briefing yet." | "No briefing for {date} — events did not warrant a morning briefing, or Argus has not yet started generation. Briefings begin at {briefingReadyTime} daily." |
| `/settings/documents` (none uploaded) | "No documents." | "Upload site documents (procedures, layouts, contact lists) to ground Argus's investigations in your operational context." |
| `/settings/webhooks/deliveries` (none) | "No deliveries." | "No webhook deliveries yet. The first delivery will appear here when an approved briefing fires." |

**Component:** `client/src/components/shared/EmptyState.jsx` — takes `icon`, `title`, `body`, optional `action`. Used everywhere.

**Acceptance:**
- Every empty-state copy answers: what happened, why, and what (if anything) the user should do.
- No "No data." or "Nothing here." strings remain.

---

## Constraints

- Notifications do not replace audit logs. Audit is forever; notifications are user-facing and dismissable.
- History navigation must work for orgs with 0 historical records (empty calendar with informative empty state).
- Status vocabulary changes are surface-level — DB enums already canonical from architecture Phase 2.

---

## Ship order

3C first (vocabulary cleanup — touches everything, do it before adding more surfaces). 3D parallel (cosmetic copy changes). 3A and 3B parallel — 3A is more impactful, 3B is more visible.
