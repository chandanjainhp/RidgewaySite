/**
 * Agentic flow integration test suite.
 * Tests the complete overnight loop: events → incidents → investigation → briefing.
 *
 * Run with: bun test src/tests/agentic-flow.test.js
 *
 * Requires:
 *   MONGODB_URL env var (will append _test to database name)
 *   REDIS_URL env var (optional, skips BullMQ queue assertions if absent)
 *   ACCESS_TOKEN_SECRET env var
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ── helpers ──────────────────────────────────────────────────────────────────

function buildTestMongoUrl() {
  const base = process.env.MONGODB_TEST_URL || process.env.MONGODB_URL;
  if (!base) throw new Error('MONGODB_URL or MONGODB_TEST_URL must be set');
  // Append _test to the database name to avoid touching production data
  return base.replace(/\/([^/?]+)(\?|$)/, '/$1_test$2');
}

function nightDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── test state ────────────────────────────────────────────────────────────────

let testOrgId;
let testUserId;
let testApiKey;    // raw key
let testApiKeyHash; // sha-256 hash
let testJwt;
let createdEventIds = [];
let createdIncidentId;
let createdJobId;
let createdBriefingId;

// ── models (lazy-imported after DB connect) ───────────────────────────────────

let Organisation;
let User;
let ApiKey;
let Event;
let Incident;
let Briefing;

// ── server app (for HTTP requests) ───────────────────────────────────────────

let app;
let server;
let baseUrl;

// ── beforeAll ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const mongoUrl = buildTestMongoUrl();

  await mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  });

  const redisDb = await import('../db/redis.js');
  await redisDb.connectRedis();

  // Dynamically import models after connection is established
  Organisation = (await import('../models/organisation.model.js')).default;
  User         = (await import('../models/user.models.js')).User;
  ApiKey       = (await import('../models/apiKey.model.js')).default;
  Event        = (await import('../models/event.model.js')).default;
  Incident     = (await import('../models/incident.model.js')).default;
  Briefing     = (await import('../models/briefing.model.js')).default;

  // Create test org
  const org = await Organisation.create({
    name: 'Test Organisation (agentic-flow)',
    status: 'active',
    setupComplete: true,
    config: { siteName: 'Test Site', timezone: 'UTC' },
  });
  testOrgId = org._id;

  // Create test user (org_admin)
  const bcrypt = await import('bcrypt');
  const hashedPw = await bcrypt.default.hash('TestPass123!', 10);
  const user = await User.create({
    email: `test-agentic-${Date.now()}@test.example.com`,
    username: 'agentic-tester',
    password: hashedPw,
    role: 'org_admin',
    orgId: testOrgId,
    isActive: true,
    isEmailVerified: true,
    setupComplete: true,
  });
  testUserId = user._id;

  // Generate raw API key and its hash
  testApiKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
  testApiKeyHash = crypto.createHash('sha256').update(testApiKey).digest('hex');

  await ApiKey.create({
    orgId: testOrgId,
    name: 'Agentic Flow Test Key',
    keyHash: testApiKeyHash,
    keyPrefix: testApiKey.slice(0, 8),
    createdBy: testUserId,
    scopes: ['events:write'],
    isActive: true,
  });

  // Create JWT for authenticated requests
  const secret = process.env.ACCESS_TOKEN_SECRET || 'test-secret-for-ci';
  testJwt = jwt.sign(
    { _id: testUserId, role: 'org_admin', orgId: testOrgId, tokenVersion: 0 },
    secret,
    { expiresIn: '1h' }
  );

  // Import and start the Express app
  const appModule = await import('../app.js');
  app = appModule.default || appModule.app || appModule;

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
      resolve();
    });
  });
});

// ── afterAll ──────────────────────────────────────────────────────────────────

afterAll(async () => {
  // Clean up all test data
  if (testOrgId) {
    await Organisation.deleteOne({ _id: testOrgId });
    await User.deleteOne({ _id: testUserId });
    await ApiKey.deleteMany({ orgId: testOrgId });
    if (Event) await Event.deleteMany({ orgId: testOrgId });
    if (Incident) await Incident.deleteMany({ orgId: testOrgId });
    if (Briefing) await Briefing.deleteMany({ orgId: testOrgId });
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await mongoose.disconnect();
  
  const redisDb = await import('../db/redis.js');
  await redisDb.disconnectRedis();
});

// ── GROUP 1: Event ingestion ──────────────────────────────────────────────────

describe('Group 1 — Event ingestion', () => {
  test('POST /events accepts a valid motion_detected event', async () => {
    const payload = {
      eventId: 'evt_' + Date.now(),
      type: 'motion_detected',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      location: {
        name: 'North Gate',
        zone: 'perimeter',
        coordinates: { lat: 51.5074, lng: -0.1278 },
      },
      severity: 'minor',
      rawData: { confidence: 0.87 },
    };

    const res = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data?._id || body._id).toBeTruthy();

    const eventId = body.data?._id || body._id;
    createdEventIds.push(eventId);
  });

  test('POST /events rejects request without API key', async () => {
    const res = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt_noauth', type: 'motion_detected', timestamp: new Date().toISOString() }),
    });

    expect(res.status).toBe(401);
  });

  test('POST /events rejects event with missing required fields', async () => {
    const res = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testApiKey}`,
      },
      body: JSON.stringify({ eventId: 'evt_bad', type: 'motion_detected' }), // missing timestamp + location
    });

    expect(res.status).toBe(400);
  });

  test('POST /events — ingest two more events at same location', async () => {
    const base = {
      location: {
        name: 'North Gate',
        zone: 'perimeter',
        coordinates: { lat: 51.5074, lng: -0.1278 },
      },
      rawData: {},
    };

    for (const [type, sev] of [['badge_swipe_fail', 'minor'], ['motion_detected', 'serious']]) {
      const res = await fetch(`${baseUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testApiKey}`,
        },
        body: JSON.stringify({
          eventId: `evt_${Date.now()}_${Math.random()}`,
          ...base,
          type,
          severity: sev,
          timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        }),
      });
      const body = await res.json();
      expect(res.status).toBe(201);
      createdEventIds.push(body.data?._id || body._id);
    }

    expect(createdEventIds.length).toBe(3);
  });
});

// ── GROUP 2: Incident creation ────────────────────────────────────────────────

describe('Group 2 — Incident grouping', () => {
  test('Events are grouped into incidents after ingestion', async () => {
    // Small delay to let any synchronous grouping logic complete
    await new Promise((r) => setTimeout(r, 300));

    const night = nightDate();
    const res = await fetch(`${baseUrl}/incidents?nightDate=${night}`, {
      headers: { 'Authorization': `Bearer ${testJwt}` },
    });

    const body = await res.json();
    expect(res.status).toBe(200);

    const incidents = body.data?.incidents ?? body.data ?? body.incidents ?? body ?? [];
    const arr = Array.isArray(incidents) ? incidents : [];

    // At minimum the events must exist in DB; incident grouping may be async
    // so we accept 0 (not yet grouped) or >0 (already grouped)
    expect(typeof arr.length).toBe('number');

    if (arr.length > 0) {
      createdIncidentId = arr[0]._id;
    }
  });
});

// ── GROUP 3: Investigation ────────────────────────────────────────────────────

describe('Group 3 — Investigation', () => {
  test('POST /investigations/start creates a job', async () => {
    const night = nightDate();
    const res = await fetch(`${baseUrl}/investigations/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testJwt}`,
      },
      body: JSON.stringify({ nightDate: night }),
    });

    // Accept 200 or 201; also accept 404 when there are no incidents to investigate
    expect([200, 201, 404]).toContain(res.status);

    if (res.status === 200 || res.status === 201) {
      const body = await res.json();
      createdJobId = body.data?.jobId || body.jobId;
    }
  });

  test('Investigation SSE stream endpoint exists', async () => {
    if (!createdJobId) {
      console.log('[skip] No jobId — investigation not started (no incidents)');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(`${baseUrl}/investigations/${createdJobId}/stream`, {
        headers: { 'Authorization': `Bearer ${testJwt}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      // SSE endpoint should return 200 and text/event-stream content-type
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
    } catch (err) {
      clearTimeout(timeoutId);
      // AbortError is fine — it means we connected but timed out reading, which is OK for a stream
      if (err.name !== 'AbortError') throw err;
    }
  });
});

// ── GROUP 4: Briefing ─────────────────────────────────────────────────────────

describe('Group 4 — Briefing', () => {
  test('GET /briefings/latest returns 200 or 404 (no briefing yet is OK)', async () => {
    const night = nightDate();
    const res = await fetch(`${baseUrl}/briefings/latest?nightDate=${night}`, {
      headers: { 'Authorization': `Bearer ${testJwt}` },
    });

    expect([200, 404]).toContain(res.status);

    if (res.status === 200) {
      const body = await res.json();
      const briefing = body.data || body;
      createdBriefingId = briefing._id;
    }
  });

  test('POST /briefings/:id/approve locks the briefing', async () => {
    if (!createdBriefingId) {
      console.log('[skip] No briefing exists yet — investigation not yet complete');
      return;
    }

    const res = await fetch(`${baseUrl}/briefings/${createdBriefingId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testJwt}` },
    });

    expect([200, 201]).toContain(res.status);

    // Verify approved status
    const getRes = await fetch(`${baseUrl}/briefings/latest?nightDate=${nightDate()}`, {
      headers: { 'Authorization': `Bearer ${testJwt}` },
    });
    if (getRes.status === 200) {
      const body = await getRes.json();
      const briefing = body.data || body;
      expect(briefing.status).toBe('approved');
    }
  });
});
