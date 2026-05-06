import express from 'express';
import { getLatestBriefing, updateBriefingSection, approveBriefing } from '../controllers/briefing.controller.js';
import { authenticateRequest, requireRole, scopeToOrg } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validation.middleware.js';
import { briefingValidator } from '../validators/index.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

// All routes are protected by auth
router.use(authenticateRequest);
router.use(requireRole('super_admin', 'org_admin', 'operator'));
router.use(scopeToOrg);

// GET /briefing/latest?nightDate=YYYY-MM-DD
router.get('/latest', asyncHandler(getLatestBriefing));

// PATCH /briefing/:id/section
router.patch('/:id/section', validate(briefingValidator.updateBriefingSectionSchema), asyncHandler(updateBriefingSection));
router.patch('/:id/sections/:sectionName', validate(briefingValidator.updateBriefingSectionSchema), asyncHandler(updateBriefingSection));

// POST /briefing/:id/approve
router.post('/:id/approve', asyncHandler(approveBriefing));

export default router;
