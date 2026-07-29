import express from 'express';
import {getLatestBriefing, updateBriefingSection, approveBriefing, retryBriefing} from '../controllers/briefing.controller.js';
import {authenticateRequest, requireRole} from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validation.middleware.js';
import {briefingValidator} from '../validators/index.js';
import {asyncHandler} from '../utils/async-handler.js';

const router = express.Router();

router.use(authenticateRequest);
router.use(requireRole('super_admin', 'org_admin', 'operator'));

// GET /briefings/latest?nightDate=YYYY-MM-DD
router.get('/latest', validate(briefingValidator.latestBriefingQuerySchema, 'query'), asyncHandler(getLatestBriefing));

// PATCH /briefings/:id/sections/:sectionName
router.patch('/:id/section', validate(briefingValidator.briefingIdParamSchema, 'params'), validate(briefingValidator.updateBriefingSectionSchema), asyncHandler(updateBriefingSection));
router.patch('/:id/sections/:sectionName', validate(briefingValidator.briefingSectionParamSchema, 'params'), validate(briefingValidator.updateBriefingSectionSchema), asyncHandler(updateBriefingSection));

// POST /briefings/:id/approve
router.post('/:id/approve', validate(briefingValidator.briefingIdParamSchema, 'params'), asyncHandler(approveBriefing));

// POST /briefings/:id/retry  (org_admin+)
router.post('/:id/retry', requireRole('super_admin', 'org_admin'), validate(briefingValidator.briefingIdParamSchema, 'params'), asyncHandler(retryBriefing));

export default router;
