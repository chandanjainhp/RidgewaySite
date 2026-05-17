import express from 'express';
import { authenticateRequest, requireRole, scopeToOrg } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  inviteOperator,
  listOrgMembers,
  getWebhookConfig,
  updateWebhookConfig,
  rotateWebhookSecret,
  getWebhookDeliveries,
  getOrgMe,
  updateOrgConfig,
  completeSetup,
  listOrgApiKeys,
  createOrgApiKey,
  revokeOrgApiKey,
  testWebhook,
  retryWebhookDelivery,
  getMcpActivity,
  ragUpload,
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  approveDocument,
  rejectDocument,
} from '../controllers/org.controller.js';

const router = express.Router();

router.use(authenticateRequest);
router.use(scopeToOrg);

// RAG Documents — open to all org members (operators can upload; approve/reject org_admin only)
router.post('/documents/upload', requireRole('org_admin', 'operator', 'super_admin'), ragUpload.single('file'), asyncHandler(uploadDocument));
router.get('/documents', requireRole('org_admin', 'operator', 'super_admin'), asyncHandler(listDocuments));
router.get('/documents/:docId', requireRole('org_admin', 'operator', 'super_admin'), asyncHandler(getDocument));
router.delete('/documents/:docId', requireRole('org_admin', 'operator', 'super_admin'), asyncHandler(deleteDocument));
router.post('/documents/:docId/approve', requireRole('org_admin', 'super_admin'), asyncHandler(approveDocument));
router.post('/documents/:docId/reject', requireRole('org_admin', 'super_admin'), asyncHandler(rejectDocument));

// Org profile — GET open to all authenticated org members; controller restricts payload by role
router.get('/me', asyncHandler(getOrgMe));

// All remaining routes require org_admin or super_admin
router.use(requireRole('org_admin', 'super_admin'));

router.patch('/me/config', asyncHandler(updateOrgConfig));
router.post('/setup/complete', asyncHandler(completeSetup));

// Members
router.post('/users/invite', asyncHandler(inviteOperator));
router.get('/users', asyncHandler(listOrgMembers));

// API keys
router.get('/api-keys', asyncHandler(listOrgApiKeys));
router.post('/api-keys', asyncHandler(createOrgApiKey));
router.delete('/api-keys/:keyId', asyncHandler(revokeOrgApiKey));

// Webhook management
router.get('/webhooks/config', asyncHandler(getWebhookConfig));
router.put('/webhooks/config', asyncHandler(updateWebhookConfig));
router.post('/webhooks/rotate-secret', asyncHandler(rotateWebhookSecret));
router.get('/webhooks/deliveries', asyncHandler(getWebhookDeliveries));
router.post('/webhooks/test', asyncHandler(testWebhook));
router.post('/webhooks/deliveries/:deliveryId/retry', asyncHandler(retryWebhookDelivery));

// MCP activity
router.get('/mcp/activity', asyncHandler(getMcpActivity));

export default router;
