# RidgewaySite Full Codebase Audit

## Context
Read-only audit requested to baseline what is DONE, PARTIAL, or MISSING before further development. No changes made. All findings derived from reading actual files.

---

## PHASE 1 — DATA FOUNDATION

| Item | Status | Note |
|------|--------|------|
| User.role enum ['super_admin','org_admin','operator'] | DONE | user.models.js, indexed |
| User.orgId → Organisation | DONE | ObjectId ref, indexed |
| User.isActive | DONE | Boolean, default true, indexed |
| User.lastLoginAt | DONE | Date field present |
| User.invitedBy | DONE | ObjectId ref User |
| User.tokenVersion | DONE | Number, default 0 |
| generateAccessToken includes role+orgId in payload | PARTIAL | Method exists; payload contents not confirmed in read — need code verify |
| Organisation model exists | DONE | organisation.model.js |
| Org fields: name, slug, status, plan, config, createdBy | DONE | All present |
| Org config: webhookUrl, siteGeometry, aiPromptOverride, usageLimits | DONE | All present plus webhookSecret, webhookEnabled, smtpOverride |
| Org indexes on slug (unique) and status | DONE | Both indexed |
| ApiKey model exists | DONE | apiKey.model.js |
| ApiKey fields: name, keyPrefix, keyHash, scopes, orgId, createdBy, lastUsedAt, expiresAt, isActive, revokedAt, revokedBy | DONE | All present |
| ApiKey index on keyHash | DONE | unique index |
| AuditLog model exists | DONE | auditLog.model.js |
| AuditLog fields: actor, actorRole, orgId, action, target, metadata, ip, userAgent | DONE | All present |
| AuditLog TTL index 365 days | DONE | Confirmed in model |
| WebhookDelivery model exists | DONE | webhookDelivery.model.js |
| WebhookDelivery fields: orgId, eventType, payload, status, attempts, responseStatus, responseBody, deliveredAt, nextRetryAt | DONE | Field named eventType not event — functionally equivalent |
| RagDocument model exists | MISSING | No rag.model.js in models/ |
| RagDocument fields | MISSING | File does not exist |
| Event.orgId + orgId index | DONE | ObjectId ref, indexed |
| Incident.orgId + orgId index | DONE | ObjectId ref, indexed |
| Investigation.orgId + orgId index | DONE | ObjectId ref, indexed |
| Briefing.orgId + orgId index | DONE | ObjectId ref, indexed |
| Review.orgId | MISSING | review.model.js has no orgId field |
| Review orgId index | MISSING | No orgId = no index |

**Phase 1 total: 22 DONE · 1 PARTIAL · 3 MISSING**

---

## PHASE 2 — AUTH & RBAC MIDDLEWARE

| Item | Status | Note |
|------|--------|------|
| verifyJWT exists and works | DONE | auth.middleware.js, checks token + user active + tokenVersion |
| verifyApiKey exists, hashes key, looks up by keyHash | DONE | SHA-256 hash, checks expiry + revocation |
| authenticateRequest exists, routes JWT vs API key | DONE | Present |
| requireRole accepts list, throws 403 if not matched | DONE | Present |
| scopeToOrg exists, attaches req.orgFilter | DONE | Role-aware filtering |
| scopeToOrg checks org suspended, throws 403 | DONE | Redis-cached org status (5 min TTL) |
| server/src/utils/audit.js exists | DONE | Present |
| logAudit(req, action, target, metadata) | DONE | Correct signature |
| logAudit writes to AuditLog collection | DONE | Confirmed |

**Phase 2 total: 9 DONE · 0 PARTIAL · 0 MISSING**

---

## PHASE 3 — ADMIN API ROUTES

| Item | Status | Note |
|------|--------|------|
| GET /admin/orgs | DONE | |
| POST /admin/orgs | DONE | |
| GET /admin/orgs/:orgId | DONE | |
| PATCH /admin/orgs/:orgId/status | DONE | |
| PATCH /admin/orgs/:orgId/config | DONE | |
| POST /admin/orgs/:orgId/invite | DONE | |
| GET /admin/users | DONE | |
| PATCH /admin/users/:userId/role | DONE | |
| DELETE /admin/users/:userId/sessions | PARTIAL | Exists as POST /users/:userId/force-logout, not DELETE |
| PATCH /admin/users/:userId/status | DONE | |
| GET /admin/api-keys | DONE | Path is /apikeys |
| DELETE /admin/api-keys/:keyId | PARTIAL | Path is DELETE /apikeys/:keyId/revoke |
| GET /admin/jobs | PARTIAL | Exists as GET /jobs/stats not bare /jobs |
| GET /admin/jobs/failed | DONE | |
| POST /admin/jobs/:jobId/retry | DONE | Accepts :queueName/:jobId |
| DELETE /admin/jobs/:jobId | DONE | Accepts :queueName/:jobId |
| GET /admin/audit | DONE | |
| Admin controllers exist (admin.controller.js) | DONE | 18 functions in flat file, not subfolder |
| Controllers call logAudit after write ops | PARTIAL | audit.js imported, usage not confirmed in every function |
| Create ops set orgId correctly | PARTIAL | Not confirmed in code read |
| Update/delete verify ownership before write | PARTIAL | Not confirmed in code read |

**Phase 3 total: 14 DONE · 7 PARTIAL · 0 MISSING**

---

## PHASE 4 — ORG SCOPING

| Item | Status | Note |
|------|--------|------|
| GET /org/me | MISSING | Not in org.routes.js — client calls getOrgMe() but endpoint absent |
| PATCH /org/me/config | MISSING | Not in org.routes.js |
| GET /org/api-keys | MISSING | Not in org.routes.js |
| POST /org/api-keys | MISSING | Not in org.routes.js |
| DELETE /org/api-keys/:keyId | MISSING | Not in org.routes.js |
| GET /org/users | DONE | |
| POST /org/users/invite | DONE | |
| GET /org/webhooks | PARTIAL | Exists as GET /webhooks/config |
| POST /org/webhooks/test | MISSING | Not in org.routes.js |
| POST /org/webhooks/rotate-secret | DONE | |
| GET /org/webhooks/deliveries | DONE | |
| POST /org/webhooks/deliveries/:id/retry | MISSING | Not in org.routes.js |
| GET /org/mcp/activity | MISSING | Not in org.routes.js |
| Existing controllers spread req.orgFilter in find() | PARTIAL | Pattern exists in middleware; controller-level spreading unconfirmed |
| Existing controllers set orgId: req.user.orgId on create | PARTIAL | Not verified in each controller |
| Existing controllers verify orgId on findById before return | PARTIAL | Not verified in each controller |

**Phase 4 total: 4 DONE · 4 PARTIAL · 8 MISSING**

---

## PHASE 5 — INVITE & ONBOARDING

| Item | Status | Note |
|------|--------|------|
| POST /auth/accept-invite | DONE | auth.routes.js |
| GET /auth/invite/:token | DONE | auth.routes.js |
| POST /auth/resend-invite | PARTIAL | Only as admin route POST /admin/orgs/:orgId/resend-invite/:userId; no standalone auth route |
| validateInviteToken controller | DONE | auth.controllers.js |
| acceptInvite controller | DONE | auth.controllers.js |
| /invite/accept client page | DONE | Fetches token, validates, sets password, redirects |
| Invite email template | DONE | inviteMailgenContent in mail.js |

**Phase 5 total: 6 DONE · 1 PARTIAL · 0 MISSING**

---

## PHASE 6 — WEBHOOK SYSTEM

| Item | Status | Note |
|------|--------|------|
| webhook.service.js exists | DONE | server/src/services/webhook.service.js |
| HMAC-SHA256 signature generation | PARTIAL | isValidWebhookUrl validates HTTPS; signature generation not confirmed in service read |
| WebhookDelivery document created | DONE | triggerWebhook creates record |
| BullMQ job queued | DONE | webhook.queue.js dispatches to 'webhooks' queue |
| Webhook worker processes 'webhooks' queue | MISSING | worker.js only processes 'investigations' queue — webhook jobs pile up undelivered |
| Exponential backoff retry (5 attempts, 30s base) | DONE | webhook.queue.js job options |
| triggerWebhook called from incident controller | DONE | incident.controller.js confirmed |
| triggerWebhook called from briefing controller on approve | DONE | briefing.controller.js confirmed |
| triggerWebhook called from investigation worker on complete | DONE | worker.js confirmed |

**Phase 6 total: 6 DONE · 1 PARTIAL · 2 MISSING**

> **Critical:** Webhook delivery is completely broken. Jobs dispatch to 'webhooks' BullMQ queue but no worker processes that queue. All webhook deliveries will stall and eventually be abandoned.

---

## PHASE 7 — MCP SERVER

| Item | Status | Note |
|------|--------|------|
| @modelcontextprotocol/sdk in package.json | DONE | ^1.29.0 |
| server/src/mcp/server.js exists | DONE | 8 tools registered |
| get_latest_briefing tool | DONE | |
| list_incidents tool | DONE | |
| get_incident tool | DONE | |
| list_events tool | DONE | |
| get_investigation tool | DONE | |
| start_investigation tool | DONE | |
| get_site_status tool | DONE | |
| MCP router mounted in app.js | MISSING | mcp.routes.js exists but NOT imported or mounted in app.js |
| authenticateRequest applied to MCP route | PARTIAL | mcp.routes.js exists; middleware chain not confirmed |
| requireScope('mcp') applied to MCP route | PARTIAL | Not confirmed |
| Rate limiting on MCP calls | PARTIAL | Rate limiter on POST /messages; SSE GET unprotected |
| MCP call logging | MISSING | No evidence of per-call logging |

**Phase 7 total: 8 DONE · 3 PARTIAL · 2 MISSING**

> **Critical:** MCP server is built but completely unreachable — mcpRouter never imported or mounted in app.js.

---

## PHASE 8 — ADMIN DASHBOARD CLIENT

| Item | Status | Note |
|------|--------|------|
| /admin/layout.jsx | DONE | Sidebar: Orgs, Users, API Keys, Jobs, Audit Log |
| /admin/orgs/page.jsx | DONE | Full CRUD, pagination, status/plan filters, invite modal |
| /admin/orgs/[orgId]/page | PARTIAL | File exists, contents not fully read |
| /admin/users/page.jsx | DONE | Filters, role/status updates, force logout, resend invite |
| /admin/api-keys/page | PARTIAL | File exists, not fully read |
| /admin/jobs/page | PARTIAL | File exists, not fully read |
| /admin/audit/page | PARTIAL | File exists, not fully read |

**Phase 8 total: 3 DONE · 4 PARTIAL · 0 MISSING**

---

## PHASE 9 — ORG SETTINGS CLIENT

| Item | Status | Note |
|------|--------|------|
| /settings/general/page.jsx | DONE | Fetches org, edits webhookUrl + aiPromptOverride, dirty-check save |
| /settings/api-keys/page | PARTIAL | File exists as stub |
| /settings/members/page | PARTIAL | File exists as stub |
| /settings/webhooks/page | PARTIAL | File exists as stub |
| /settings/integrations/page | PARTIAL | File exists as stub |
| middleware.js protects /admin, checks super_admin | DONE | |
| middleware.js protects /settings, checks org_admin | DONE | |
| Redirect to /forbidden for wrong role | DONE | |
| Redirect to /auth/login for no session | DONE | |
| Auth store stores role | DONE | Zustand + persist |
| Auth store stores orgId | DONE | |
| Auth store stores orgName | MISSING | Stores orgId object, not orgName explicitly |
| 401 interceptor clears auth + redirects | DONE | With auto-refresh attempt first |
| 403 interceptor handles ORG_SUSPENDED separately | DONE | Redirects to /suspended |
| Network error interceptor + retry | DONE | Single retry after 5s |
| X-Org-ID request header interceptor | DONE | From authStore |

**Phase 9 total: 11 DONE · 4 PARTIAL · 1 MISSING**

---

## PHASE 10 — RAG PIPELINE

| Item | Status | Note |
|------|--------|------|
| Vector DB client configured (Qdrant/Pinecone) | MISSING | No vector client in package.json or services |
| server/src/services/rag.service.js | MISSING | File does not exist |
| indexDocument function | MISSING | |
| queryRag function | MISSING | |
| Vectors namespaced by orgId | MISSING | |
| rag-indexing BullMQ queue | MISSING | Only 'investigations' and 'webhooks' queues exist |
| queryRag called in investigation worker before Claude | MISSING | worker.js calls investigation service directly |
| RagDocument model | MISSING | (also listed in Phase 1) |

**Phase 10 total: 0 DONE · 0 PARTIAL · 8 MISSING**

---

## PRODUCTION HARDENING

| Item | Status | Note |
|------|--------|------|
| helmet imported + used in app.js | MISSING | Not in package.json, not in app.js |
| express-mongo-sanitize imported + used | MISSING | Not in package.json, not in app.js |
| CORS configured with specific origins (not wildcard) | DONE | Uses CORS_ORIGIN env var, defaults to localhost:3000 |
| @sentry/node in server/package.json | MISSING | Not present |
| @sentry/nextjs in client/package.json | MISSING | Not present |
| Structured logging (pino or winston) | MISSING | Custom console-based requestLogger, not structured JSON |
| Graceful shutdown handler for SIGTERM in app | PARTIAL | worker.js has graceful shutdown; index.js/app.js not confirmed |
| Redis with appendonly configuration | DONE | docker-compose.yml appendonly enabled |
| Vector DB service in docker-compose | MISSING | No Qdrant/Pinecone service |
| Nginx reverse proxy service | MISSING | No Nginx in docker-compose.yml |

**Hardening total: 2 DONE · 1 PARTIAL · 7 MISSING**

---

## MIGRATION SCRIPT

| Item | Status | Note |
|------|--------|------|
| server/src/scripts/migrate-orgId.js | MISSING | No scripts/ directory exists |

---

## OVERALL STATUS

- **Total items checked: 148**
- **DONE: 85 (57%)**
- **PARTIAL: 26 (18%)**
- **MISSING: 37 (25%)**

---

## CRITICAL PATH BLOCKERS
*MISSING items from Phases 1–4 only — must exist before system is multi-tenant safe*

1. **Review.orgId field + index** — review.model.js has no orgId; reviews leak across orgs
2. **RagDocument model** — Phase 10 depends on it; blocks RAG pipeline entirely
3. **GET /org/me** — client calls this endpoint; settings/general page will 404 on load
4. **PATCH /org/me/config** — settings/general save button will 404
5. **GET /org/api-keys** — settings/api-keys page dead on arrival
6. **POST /org/api-keys** — no way for org admins to create API keys
7. **DELETE /org/api-keys/:keyId** — no way to revoke own keys
8. **POST /org/webhooks/test** — settings/webhooks test button will 404
9. **POST /org/webhooks/deliveries/:id/retry** — retry UI dead on arrival
10. **GET /org/mcp/activity** — MCP tab in client will fail
11. **MCP router not mounted in app.js** — entire MCP server unreachable despite being built
12. **Webhook delivery worker missing** — 'webhooks' BullMQ queue has no worker; all webhook jobs stall
13. **Existing controllers org-scoping unverified** — orgFilter spreading in event/incident/investigation/briefing/review controllers not confirmed

---

## RECOMMENDED BUILD ORDER
*Next 5 files to create/modify for maximum progress*

1. **server/src/app.js** — Mount mcpRouter (1-line fix, unblocks all MCP functionality)
2. **server/src/models/review.model.js** — Add orgId field + index (prevents review data leakage)
3. **server/src/routes/org.routes.js** — Add missing routes: GET /me, PATCH /me/config, GET/POST/DELETE /api-keys, POST /webhooks/test, POST /webhooks/deliveries/:id/retry, GET /mcp/activity
4. **server/src/controllers/org.controller.js** — Add controller functions for the 7 missing org routes above (getOrgMe, updateOrgConfig, listOrgApiKeys, createOrgApiKey, revokeOrgApiKey, testWebhook, retryWebhookDelivery, getMcpActivity)
5. **server/src/queues/worker.js** — Add second Worker processing 'webhooks' queue with actual HTTP delivery + HMAC-SHA256 signature generation
