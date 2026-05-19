import express from 'express';
import {
  getLatestBriefing,
  updateBriefingSection,
  approveBriefing,
  retryBriefing,
  streamBriefingProgress,
} from '../controllers/briefing.controller.js';
import { authenticateRequest, requireRole, scopeToOrg } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validation.middleware.js';
import { briefingValidator } from '../validators/index.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

router.use(authenticateRequest);
router.use(requireRole('super_admin', 'org_admin', 'operator'));
router.use(scopeToOrg);

// GET /briefings/latest?nightDate=YYYY-MM-DD
router.get('/latest', asyncHandler(getLatestBriefing));

// PATCH /briefings/:id/sections/:sectionName
router.patch('/:id/section', validate(briefingValidator.updateBriefingSectionSchema), asyncHandler(updateBriefingSection));
router.patch('/:id/sections/:sectionName', validate(briefingValidator.updateBriefingSectionSchema), asyncHandler(updateBriefingSection));

// POST /briefings/:id/approve
router.post('/:id/approve', asyncHandler(approveBriefing));

// POST /briefings/:id/retry  (org_admin+)
router.post('/:id/retry', requireRole('super_admin', 'org_admin'), asyncHandler(retryBriefing));

// GET /briefings/:id/stream  — SSE
router.get('/:id/stream', streamBriefingProgress);

export default router;
