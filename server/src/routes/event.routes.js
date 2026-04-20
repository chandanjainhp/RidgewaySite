import express from 'express';
import { getEventsForNight, getEventById, applyMayaReview } from '../controllers/event.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validation.middleware.js';
import { eventValidator } from '../validators/index.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

// All routes are protected by auth
router.use(verifyJWT);

// GET /events?nightDate=YYYY-MM-DD
router.get('/', asyncHandler(getEventsForNight));

// GET /events/:id
router.get('/:id', asyncHandler(getEventById));

// PATCH/POST /events/:id/review
router.patch('/:id/review', validate(eventValidator.applyReviewSchema), asyncHandler(applyMayaReview));
router.post('/:id/review', validate(eventValidator.applyReviewSchema), asyncHandler(applyMayaReview));

export default router;
