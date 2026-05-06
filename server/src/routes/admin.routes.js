import express from 'express';
import { authenticateRequest, requireRole } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  listOrgs, createOrg, getOrgDetail, updateOrgStatus, updateOrgConfig, inviteOrgAdmin, resendInvite,
  listUsers, setUserRole, forceLogout, updateUserStatus,
  listApiKeys, revokeApiKey,
  getQueueStats, getFailedJobs, retryJob, deleteJob,
  getAuditLogs
} from '../controllers/admin.controller.js';

const router = express.Router();

// ALL admin routes strictly require super_admin role
router.use(authenticateRequest);
router.use(requireRole('super_admin'));

// Org Management
router.get('/orgs', asyncHandler(listOrgs));
router.post('/orgs', asyncHandler(createOrg));
router.get('/orgs/:orgId', asyncHandler(getOrgDetail));
router.patch('/orgs/:orgId/status', asyncHandler(updateOrgStatus));
router.patch('/orgs/:orgId/config', asyncHandler(updateOrgConfig));
router.post('/orgs/:orgId/invite', asyncHandler(inviteOrgAdmin));
router.post('/orgs/:orgId/resend-invite/:userId', asyncHandler(resendInvite));

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

export default router;
