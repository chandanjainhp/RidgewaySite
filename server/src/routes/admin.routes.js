import express from 'express';
import { authenticateRequest, requireRole } from '../middlewares/auth.middleware.js';
import { requireAdminGateSession } from '../controllers/adminGate.controllers.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  getAdminSite, updateAdminSite,
  listUsers, setUserRole, forceLogout, updateUserStatus,
  listApiKeys, revokeApiKey,
  getQueueStats, getFailedJobs, retryJob, deleteJob,
  getAuditLogs,
} from '../controllers/admin.controller.js';
import OutboxEvent from '../models/outboxEvent.model.js';
import { ApiResponse } from '../utils/api-response.js';
import { ApiError } from '../utils/api-error.js';

const router = express.Router();

router.use(authenticateRequest);
router.use(requireRole('super_admin'));

// Site singleton
router.get('/site', requireAdminGateSession, asyncHandler(getAdminSite));
router.patch('/site', requireAdminGateSession, asyncHandler(updateAdminSite));

// User Management
router.get('/users', asyncHandler(listUsers));
router.patch('/users/:userId/role', asyncHandler(setUserRole));
router.post('/users/:userId/force-logout', asyncHandler(forceLogout));
router.patch('/users/:userId/status', asyncHandler(updateUserStatus));

// API Keys
router.get('/apikeys', asyncHandler(listApiKeys));
router.delete('/apikeys/:keyId/revoke', asyncHandler(revokeApiKey));

// Jobs Monitor
router.get('/jobs/stats', asyncHandler(getQueueStats));
router.get('/jobs/failed', asyncHandler(getFailedJobs));
router.post('/jobs/:queueName/:jobId/retry', asyncHandler(retryJob));
router.delete('/jobs/:queueName/:jobId', asyncHandler(deleteJob));

// Audit Logs
router.get('/audit', asyncHandler(getAuditLogs));

router.get('/outbox', asyncHandler(async (req, res) => {
  const { status, limit = 50, skip = 0 } = req.query;
  const filter = status ? { status } : { status: { $in: ['pending', 'failed'] } };
  const [rows, total] = await Promise.all([
    OutboxEvent.find(filter).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit)).lean(),
    OutboxEvent.countDocuments(filter),
  ]);
  res.status(200).json(new ApiResponse(200, { rows, total }, 'Outbox fetched'));
}));

router.post('/outbox/:id/retry', asyncHandler(async (req, res) => {
  const row = await OutboxEvent.findByIdAndUpdate(
    req.params.id,
    { $set: { status: 'pending', lastError: null } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Outbox event not found');
  res.status(200).json(new ApiResponse(200, row, 'Outbox event reset to pending'));
}));

export default router;
