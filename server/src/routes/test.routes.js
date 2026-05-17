/**
 * TEST ROUTES — development only
 * Gated by NODE_ENV check in app.js.
 * Provides seed-events, trigger-investigation, status poll, briefing fetch, cleanup.
 */

import express from 'express';
import { authenticateRequest, scopeToOrg } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import Event from '../models/event.model.js';
import Incident from '../models/incident.model.js';
import Investigation from '../models/investigation.model.js';
import Briefing from '../models/briefing.model.js';
import Organisation from '../models/organisation.model.js';
import { startNightInvestigation } from '../services/investigation.service.js';
import { getJobStatus } from '../queues/investigation.queue.js';

const router = express.Router();
router.use(authenticateRequest);
router.use(scopeToOrg);

/* ── helpers ──────────────────────────────────────────── */

const EVENT_TYPES = ['fence_alert', 'vehicle_detected', 'badge_fail', 'motion_sensor'];
const ZONES = ['perimeter', 'yard', 'block', 'access_point'];

/**
 * Generate a random night timestamp between startHour and endHour,
 * spanning midnight (e.g. 22:00 → 06:00 next day).
 */
function randomNightTs(baseDate, startHour, endHour) {
  const start = new Date(baseDate);
  start.setHours(startHour, 0, 0, 0);

  const end = new Date(baseDate);
  if (endHour <= startHour) {
    end.setDate(end.getDate() + 1);
  }
  end.setHours(endHour, 59, 59, 0);

  const rangeMs = end.getTime() - start.getTime();
  return new Date(start.getTime() + Math.random() * rangeMs);
}

function pickSeverity(severities) {
  // Default realistic distribution: 60% harmless, 30% minor/monitor, 10% serious/escalate
  if (severities) {
    return severities[Math.floor(Math.random() * severities.length)];
  }
  const roll = Math.random();
  if (roll < 0.60) return 'harmless';
  if (roll < 0.90) return 'monitor';
  return 'escalate';
}

function getNightDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayNightDate() {
  return getNightDate(new Date());
}

function parseNightDate(raw) {
  if (!raw) return todayNightDate();
  const d = new Date(raw);
  if (isNaN(d)) throw new ApiError(400, `Invalid nightDate: "${raw}"`);
  return getNightDate(d);
}

function toISODate(d) {
  return d.toISOString().split('T')[0];
}

/* ── POST /test/seed-events ───────────────────────────── */
router.post('/seed-events', asyncHandler(async (req, res) => {
  const {
    count = 5,
    startHour = 22,
    endHour = 6,
    zones: reqZones,
    severities: reqSeverities,
  } = req.body;

  const orgId = req.user.orgId;
  if (!orgId) throw new ApiError(400, 'No orgId on user — super_admin cannot seed events without specifying an org');

  if (typeof count !== 'number' || count < 1 || count > 50) {
    throw new ApiError(400, 'count must be a number between 1 and 50');
  }

  const nightDate = todayNightDate();
  const dateStr = toISODate(nightDate).replace(/-/g, '');

  // Resolve location zones from org config or fallback list
  const org = await Organisation.findById(orgId).select('config').lean();
  const orgCoords = org?.config?.coordinates;
  const centerLat = orgCoords?.lat ?? 51.5074;
  const centerLng = orgCoords?.lng ?? -0.1278;

  const zoneNames = Array.isArray(reqZones) && reqZones.length > 0
    ? reqZones
    : ['North Gate', 'South Perimeter', 'Loading Bay', 'Yard A', 'Block C'];

  // Build events
  const events = [];
  const existingCount = await Event.countDocuments({ ...req.orgFilter, nightDate });

  for (let i = 0; i < count; i++) {
    const idx = existingCount + i + 1;
    const eventId = `TEST-${dateStr}-${String(idx).padStart(3, '0')}`;

    const zoneName = zoneNames[Math.floor(Math.random() * zoneNames.length)];
    const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
    const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const severity = pickSeverity(reqSeverities);
    const ts = randomNightTs(nightDate, startHour, endHour);

    // Jitter coords slightly around org center
    const lat = centerLat + (Math.random() - 0.5) * 0.005;
    const lng = centerLng + (Math.random() - 0.5) * 0.005;

    const evt = await Event.create({
      eventId,
      orgId,
      nightDate,
      type,
      location: {
        name: zoneName,
        coordinates: { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) },
        zone,
      },
      timestamp: ts,
      severity,
      rawData: { source: 'test-api', generated: true },
    });

    events.push({
      id: evt._id,
      eventId: evt.eventId,
      type: evt.type,
      location: evt.location.name,
      severity: evt.severity,
      timestamp: evt.timestamp,
    });

    console.log('[TEST API] seed-events created', orgId, eventId);
  }

  res.status(201).json(new ApiResponse(201, {
    message: `Generated ${count} events for ${toISODate(nightDate)}`,
    count: events.length,
    events,
    nightDate: toISODate(nightDate),
  }, 'Test events seeded'));
}));

/* ── POST /test/trigger-investigation ────────────────── */
router.post('/trigger-investigation', asyncHandler(async (req, res) => {
  const nightDate = parseNightDate(req.body?.nightDate);

  console.log('[TEST API] trigger-investigation', req.user.orgId, toISODate(nightDate));

  const result = await startNightInvestigation(toISODate(nightDate), req.orgFilter);

  if (result.status === 'already_running') {
    return res.status(200).json(new ApiResponse(200, {
      message: 'Investigation already running',
      jobIds: result.jobIds,
      status: 'already_running',
    }, 'Already running'));
  }

  if (result.status === 'no_incidents') {
    return res.status(400).json(new ApiResponse(400, {
      message: 'No incidents found. POST /test/seed-events first.',
      status: 'no_incidents',
    }, 'No incidents'));
  }

  const firstJobId = result.jobIds?.[0] ?? null;

  res.status(201).json(new ApiResponse(201, {
    message: 'Investigation started',
    jobIds: result.jobIds,
    jobId: firstJobId,
    totalJobs: result.totalJobs,
    status: result.status ?? 'queued',
    estimatedDuration: '30–60 seconds with LM Studio, 10–20 seconds with Claude API',
    streamUrl: firstJobId ? `/api/v1/investigations/${firstJobId}/stream` : null,
  }, 'Investigation triggered'));
}));

/* ── GET /test/investigation-status/:jobId ────────────── */
router.get('/investigation-status/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  let jobState = null;
  try {
    jobState = await getJobStatus(jobId);
  } catch {
    // Queue may not have the job if it completed and was removed
  }

  // Also check Investigation collection for persistent state
  const inv = await Investigation.findOne({
    ...req.orgFilter,
    jobId,
  }).select('status toolCallSequence finalSeverity').lean();

  // Get today's briefing status
  const nightDate = todayNightDate();
  const start = new Date(nightDate); start.setHours(0, 0, 0, 0);
  const end = new Date(nightDate); end.setHours(23, 59, 59, 999);

  const briefing = await Briefing.findOne({
    ...req.orgFilter,
    nightDate: { $gte: start, $lte: end },
  }).select('status').lean();

  const toolCallsExecuted = inv?.toolCallSequence?.length ?? 0;
  const status = inv?.status ?? jobState?.state ?? 'unknown';

  res.status(200).json(new ApiResponse(200, {
    jobId,
    status,
    progress: {
      toolCallsExecuted,
      averageConfidence: null,
    },
    briefingStatus: briefing?.status ?? 'not_started',
  }, 'Status fetched'));
}));

/* ── GET /test/briefing ───────────────────────────────── */
router.get('/briefing', asyncHandler(async (req, res) => {
  const nightDate = todayNightDate();
  const start = new Date(nightDate); start.setHours(0, 0, 0, 0);
  const end = new Date(nightDate); end.setHours(23, 59, 59, 999);

  const briefing = await Briefing.findOne({
    ...req.orgFilter,
    nightDate: { $gte: start, $lte: end },
  }).lean();

  if (!briefing) throw new ApiError(404, 'No briefing found for today. Run an investigation first.');

  res.status(200).json(new ApiResponse(200, { briefing }, 'Briefing fetched'));
}));

/* ── POST /test/cleanup ───────────────────────────────── */
router.post('/cleanup', asyncHandler(async (req, res) => {
  const { nightDate: rawDate } = req.body;
  if (!rawDate) throw new ApiError(400, 'nightDate is required to prevent accidental wipes');

  const nightDate = parseNightDate(rawDate);
  const start = new Date(nightDate); start.setHours(0, 0, 0, 0);
  const end = new Date(nightDate); end.setHours(23, 59, 59, 999);

  const filter = { ...req.orgFilter, nightDate: { $gte: start, $lte: end } };

  const [evtResult, incResult, invResult, brfResult] = await Promise.all([
    Event.deleteMany(filter),
    Incident.deleteMany(filter),
    Investigation.deleteMany(filter),
    Briefing.deleteMany(filter),
  ]);

  console.log('[TEST API] cleanup', req.user.orgId, toISODate(nightDate), {
    events: evtResult.deletedCount,
    incidents: incResult.deletedCount,
    investigations: invResult.deletedCount,
    briefings: brfResult.deletedCount,
  });

  res.status(200).json(new ApiResponse(200, {
    message: `Cleaned up test data for ${toISODate(nightDate)}`,
    deleted: {
      events: evtResult.deletedCount,
      incidents: incResult.deletedCount,
      investigations: invResult.deletedCount,
      briefings: brfResult.deletedCount,
    },
  }, 'Cleanup complete'));
}));

export default router;
