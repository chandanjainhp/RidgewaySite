# Phase 3 — Reliability

**Goal.** Eliminate three silent-data-loss paths: briefing state lives in the client, webhooks rely on dual-write between DB and queue, event ingestion has no deduplication.

**Read first:** `CLAUDE.md` §6, §9, §11, §22, §23, `server/src/queues/worker.js`, `server/src/controllers/briefing.controller.js`, `server/src/controllers/event.controller.js`, `client/src/store/investigationStore.js`, this prompt.

---

## 3A — Briefing state on the server (3 days)

**Problem.** `/briefing` detects "in progress" by reading Zustand (`investigationStore.jobStatus`). The DB only knows `draft|approved`. Refresh mid-investigation → the state vanishes. After the schema reconciliation work, the DB enum is `generating | draft | approved | failed` — make this actually drive the UI.

**Server changes:**

1. **Briefing.status state machine.**
   - `generating`: set the moment a `Briefing` record is created (in `briefing.service.js#buildBriefing` start). 
   - `draft`: set when all section content is filled in and the build completes.
   - `approved`: set by `POST /briefings/:id/approve` (existing).
   - `failed`: set in the catch block of `buildBriefing`; include `failureReason` field.
   - Add `generationStartedAt`, `generationCompletedAt`, `failureReason` fields to the schema.

2. **`GET /briefings/latest`** must return `status` reliably, plus `generationStartedAt`, `failureReason` when relevant. The frontend should never need a second call.

3. **SSE channel for briefing progress.** Reuse the agent stream Pub/Sub channel pattern from Phase 2A. Add a new channel `briefing:status:{briefingId}` published from `buildBriefing` at: start, after each section drafted, on completion, on failure. The `/briefings/:id/stream` endpoint subscribes and forwards.

4. **Retry endpoint.** `POST /briefings/:id/retry` (org_admin+). Only valid if `status === 'failed'`. Resets status to `generating`, clears `failureReason`, enqueues a new build job. Audit: `briefing.retry`.

**Client changes:**

1. `/briefing` page state derivation:
   - Source of truth: `briefing.status` from `GET /briefings/latest`.
   - **Delete** the Zustand-driven "in progress" detection.
   - Map status → UI state:
     - `generating` → show progress UI driven by `/briefings/:id/stream` SSE
     - `draft` → editable document + Approve button
     - `approved` → read-only with approval metadata
     - `failed` → red call-out, failure reason, Retry button (org_admin+ only)
     - missing record → empty state with link to `/investigate`
2. `useBriefing` hook: subscribe to status SSE when status === `generating`. Unsubscribe on completion or unmount.

**Acceptance:**
- Approve a briefing, refresh — still shows approved.
- Trigger generation, refresh mid-build — still shows generating with live progress.
- Kill the worker mid-build — status moves to `failed` with a reason; Retry works.

---

## 3B — Webhook outbox (4 days)

**Problem.** `briefing.controller.js#approveBriefing` updates the DB then enqueues a webhook job. If the API crashes between those two operations, the webhook is never delivered. MongoDB transactions need a replica set; assume we don't have one. Use an outbox.

**Schema additions:**

`server/src/models/outboxEvent.model.js`:
```js
{
  orgId: ObjectId,
  eventType: String,                    // 'briefing.approved', 'incident.created', etc.
  payload: Mixed,
  status: { type: String, enum: ['pending', 'dispatched', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  lastError: String,
  dispatchedAt: Date,
  createdAt: Date,
  updatedAt: Date,
}
// Index: { status: 1, createdAt: 1 } for the poller
// Index: { orgId: 1, createdAt: -1 } for org-scoped queries
```

**Write path changes:**

Every place that currently calls `triggerWebhook(orgId, eventType, payload)`:
- `briefing.controller.js#approveBriefing`
- `incident.controller.js#createIncident`
- `queues/worker.js` (investigation completion)
- Any other emitter

Replace with: `await OutboxEvent.create({ orgId, eventType, payload, status: 'pending' })`. This is a single-collection write — atomic with the rest of the transaction-equivalent operation only when batched in the same handler. The point is: the write is durable before the controller returns 2xx.

**Outbox poller:**

`server/src/workers/outbox-poller.js`:
- Runs inside the worker process (Phase 2B split).
- Every 2s: `OutboxEvent.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(50)`.
- For each: create the `WebhookDelivery` record (existing model), set `OutboxEvent.status = 'dispatched'`, dispatch the BullMQ job.
- Use a Redis lock `outbox:poller:{podId}` to prevent concurrent pollers from picking the same row. Or simpler: use MongoDB's `findOneAndUpdate({ status: 'pending' }, { status: 'dispatched' })` atomicity to claim rows.
- On failure to dispatch: increment `attempts`, set `lastError`, leave `status = 'pending'` for retry. After 10 attempts, set `status = 'failed'` and emit an audit log.

**Cleanup job:**

Scheduled BullMQ job daily: delete `OutboxEvent` records with `status === 'dispatched'` and `createdAt < now - 7 days`. Retain `failed` rows indefinitely until manually resolved.

**Admin surface:**

`GET /admin/outbox` (super_admin) — list pending/failed outbox rows for cross-org diagnostics.
`POST /admin/outbox/:id/retry` — reset `status` to `pending`.

**Acceptance:**
- Approve a briefing, immediately `kill -9` the API container. Restart. Webhook delivers within 4s.
- Force the receiving endpoint to 500. After 10 retries, outbox row → `failed`, audit log entry created.

---

## 3C — Event ingestion idempotency (2 days)

**Problem.** Drones retry on network failure. Duplicate events → duplicate incidents from correlation → duplicate Argus runs → duplicate API spend.

**Spec:**

`POST /api/v1/events` accepts a request header `Idempotency-Key`. If present:
- Compute key `idem:event:{orgId}:{idempotencyKey}`.
- Check Redis. If present, return the cached response (200/201 with the original event ID). Do not write.
- If absent, process normally. Cache the response body under the key with 24h TTL.
- Per-key idempotency is org-scoped (key collision across orgs is fine).

If header is absent:
- Compute a content hash: SHA-256 of `{orgId, type, timestamp, location.name, severity}`.
- Check Redis `idem:event:hash:{orgId}:{hash}` with 5-minute TTL.
- If present, return 200 with the existing event ID and a header `X-Idempotency: hash-dedup`.
- If absent, process, cache.

**Why two paths.** Well-behaved drones send `Idempotency-Key` (we document this in the API). Existing drones won't. The hash path is a safety net for the existing fleet, with a tighter TTL so it doesn't drop legitimate duplicate events that happen to share a timestamp 6 hours apart.

**Implementation:**

`server/src/middlewares/idempotency.middleware.js`:
- Apply before `events.controller#ingestEvent`.
- Read header, look up Redis, short-circuit if hit.
- Otherwise attach `req.idempotencyKey` and `req.contentHash`; let controller proceed.
- After controller responds (use `res.on('finish')`), write the cache.

**Documentation:**

`docs/drone-api.md` (new file):
- `POST /events` accepts `Idempotency-Key` header (recommended: `<uuid-v4>` per event).
- Cached responses for 24h.
- 200 vs 201 semantics: 201 on first write, 200 on cached return.

**Acceptance:**
- Send the same event twice with the same `Idempotency-Key` → one row in DB, both responses identical.
- Send the same event twice in a 5min window without header → one row in DB, second response has `X-Idempotency: hash-dedup`.
- Send the same event twice 10min apart without header → two rows (intentional; the hash path doesn't retain that long).

---

## Constraints (do not break)

1. The outbox is **forward-only.** Never delete a `pending` or `failed` row from anywhere except the cleanup job.
2. Briefing status transitions are unidirectional except `failed → generating` (via retry endpoint only).
3. Idempotency cache must be org-scoped. A key from Org A must never short-circuit a write for Org B.
4. All new schemas include `orgId` and the appropriate index.
5. Migration: existing in-flight webhook jobs at deploy time must drain before the new outbox starts dispatching, otherwise duplicate deliveries. Use a feature flag `OUTBOX_ENABLED=true` that gates both the write-side change and the poller.

---

## Ship order

3A first (smallest scope, unblocks the briefing UX). Then 3C (event idempotency — independent, low risk). Then 3B (outbox — touches the most code paths). 3A and 3C can ship in parallel by different developers.
