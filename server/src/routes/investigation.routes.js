import express from 'express';
import { startInvestigation, getInvestigation, streamInvestigationProgress } from '../controllers/investigation.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validation.middleware.js';
import { investigationValidator } from '../validators/index.js';
import { asyncHandler } from '../utils/async-handler.js';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/api-error.js';

const router = express.Router();

// Lightweight query-param token verification for SSE (cannot use headers with EventSource API)
const verifyQueryToken = asyncHandler(async (req, res, next) => {
  const token = req.query.token;

  if (!token) {
    throw new ApiError(401, 'Unauthorized: token required in query params');
  }

  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = { _id: decodedToken._id };
    next();
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired token');
  }
});

// POST /investigations/start (protected by JWT)
router.post('/start', verifyJWT, validate(investigationValidator.startInvestigationSchema), asyncHandler(startInvestigation));
router.post('/', verifyJWT, validate(investigationValidator.startInvestigationSchema), asyncHandler(startInvestigation));

// GET /investigations/:jobId/stream (SSE endpoint - auth via query param)
// Place this BEFORE the generic /:id route so it matches first
router.get('/:jobId/stream', verifyQueryToken, asyncHandler(streamInvestigationProgress));

// GET /investigations/:id (protected by JWT)
router.get('/:id', verifyJWT, asyncHandler(getInvestigation));

export default router;
