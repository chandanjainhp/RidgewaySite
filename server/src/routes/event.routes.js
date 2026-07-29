import express from 'express';
import {getEventsForNight, getEventById, ingestEvents} from '../controllers/event.controller.js';
import {authenticateRequest, requireRole, verifyIngestionSecret} from '../middlewares/auth.middleware.js';
import {idempotencyMiddleware} from '../middlewares/idempotency.middleware.js';
import {eventsLimiter} from '../middlewares/rateLimit.middleware.js';
import validate from '../middlewares/validation.middleware.js';
import {eventValidator} from '../validators/index.js';
import {asyncHandler} from '../utils/async-handler.js';

const router = express.Router();

// POST /events — drone ingestion (site secret only)
router.post(
  '/',
  eventsLimiter,
  verifyIngestionSecret,
  validate(eventValidator.ingestEventsSchema),
  idempotencyMiddleware,
  asyncHandler(ingestEvents),
);

// JWT-protected reads
router.use(authenticateRequest);
router.use(requireRole('super_admin', 'org_admin', 'operator'));

router.get('/', validate(eventValidator.nightDateQuerySchema, 'query'), asyncHandler(getEventsForNight));
router.get('/:id', validate(eventValidator.mongoIdParamSchema, 'params'), asyncHandler(getEventById));

export default router;
