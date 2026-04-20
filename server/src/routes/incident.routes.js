import express from 'express';
import { getIncidents, getIncidentById, getIncidentEvidenceGraph } from '../controllers/incident.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

// All routes are protected by auth
router.use(verifyJWT);

// GET /incidents?nightDate=YYYY-MM-DD&status=&severity=
router.get('/', asyncHandler(getIncidents));

// GET /incidents/:id
router.get('/:id', asyncHandler(getIncidentById));

// GET /incidents/:id/graph - evidence graph for visual representation
router.get('/:id/graph', asyncHandler(getIncidentEvidenceGraph));
router.get('/:id/evidence-graph', asyncHandler(getIncidentEvidenceGraph));

export default router;
