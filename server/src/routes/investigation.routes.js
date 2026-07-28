import express from 'express';
import {startInvestigation, getInvestigation} from '../controllers/investigation.controller.js';
import {authenticateRequest, requireRole} from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validation.middleware.js';
import {investigationValidator} from '../validators/index.js';
import {asyncHandler} from '../utils/async-handler.js';

const router = express.Router();

// POST /investigations/start (protected by JWT/API Key)
router.post('/start', authenticateRequest, requireRole('super_admin', 'org_admin', 'operator'), validate(investigationValidator.startInvestigationSchema), asyncHandler(startInvestigation));
router.post('/', authenticateRequest, requireRole('super_admin', 'org_admin', 'operator'), validate(investigationValidator.startInvestigationSchema), asyncHandler(startInvestigation));

// GET /investigations/:id (protected by JWT/API Key)
router.get('/:id', authenticateRequest, requireRole('super_admin', 'org_admin', 'operator'), asyncHandler(getInvestigation));

export default router;
