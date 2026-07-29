import express from 'express';
import {getIncidents, getIncidentById, getIncidentEvidenceGraph} from '../controllers/incident.controller.js';
import {authenticateRequest, requireRole} from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validation.middleware.js';
import {incidentValidator} from '../validators/index.js';
import {asyncHandler} from '../utils/async-handler.js';

const router = express.Router();

// All routes are protected by auth
router.use(authenticateRequest);
router.use(requireRole('super_admin', 'org_admin', 'operator'));

// GET /incidents?nightDate=YYYY-MM-DD&status=&severity=
router.get('/', validate(incidentValidator.listIncidentsQuerySchema, 'query'), asyncHandler(getIncidents));

// GET /incidents/:id
router.get('/:id', validate(incidentValidator.mongoIdParamSchema, 'params'), asyncHandler(getIncidentById));

// GET /incidents/:id/graph - evidence graph for visual representation
router.get('/:id/graph', validate(incidentValidator.mongoIdParamSchema, 'params'), asyncHandler(getIncidentEvidenceGraph));
router.get('/:id/evidence-graph', validate(incidentValidator.mongoIdParamSchema, 'params'), asyncHandler(getIncidentEvidenceGraph));

export default router;
