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
  listOrgApiKeys,
  createOrgApiKey,
  revokeOrgApiKey,
  testWebhook,
  retryWebhookDelivery,
  getMcpActivity,
} from '../controllers/org.controller.js';

const router = express.Router();

router.use(authenticateRequest);
router.use(scopeToOrg);
router.use(requireRole('org_admin', 'super_admin'));

// Org profile
router.get('/me', asyncHandler(getOrgMe));
router.patch('/me/config', asyncHandler(updateOrgConfig));

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
