import express from 'express';
import { createReview, getReviewsForNight } from '../controllers/review.controller.js';
import { authenticateRequest, requireRole, scopeToOrg } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validation.middleware.js';
import { reviewValidator } from '../validators/index.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

// All routes are protected by auth
router.use(authenticateRequest);
router.use(requireRole('super_admin', 'org_admin', 'operator'));
router.use(scopeToOrg);

// POST /reviews
router.post('/', validate(reviewValidator.createReviewSchema), asyncHandler(createReview));

// GET /reviews/night/:date
router.get('/', asyncHandler(getReviewsForNight));
router.get('/night/:date', asyncHandler(getReviewsForNight));

export default router;
