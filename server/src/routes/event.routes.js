import express from 'express';
import { getEventsForNight, getEventById, ingestEvents } from '../controllers/event.controller.js';
import { authenticateRequest, requireRole, scopeToOrg } from '../middlewares/auth.middleware.js';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

// All routes are protected by auth
router.use(authenticateRequest);
router.use(requireRole('super_admin', 'org_admin', 'operator', 'api_key'));
router.use(scopeToOrg);

// GET /events?nightDate=YYYY-MM-DD
router.get('/', asyncHandler(getEventsForNight));

// POST /events
router.post('/', idempotencyMiddleware, asyncHandler(ingestEvents));

// GET /events/:id
router.get('/:id', asyncHandler(getEventById));

export default router;
