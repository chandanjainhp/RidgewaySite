import express from 'express';
import { authenticateRequest, requireRole, scopeToOrg } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
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
  getIngestionStatus,
  testWebhook,
  retryWebhookDelivery,
} from '../controllers/org.controller.js';
import { requireAdminGateSession } from '../controllers/adminGate.controllers.js';

const router = express.Router();

router.use(authenticateRequest);
router.use(scopeToOrg);

// Org profile — GET open to all authenticated org members; controller restricts payload by role
router.get('/me', asyncHandler(getOrgMe));

// All remaining routes require org_admin or super_admin
router.use(requireRole('org_admin', 'super_admin'));
router.post('/setup/complete', asyncHandler(completeSetup));
router.use(requireAdminGateSession);

router.patch('/me/config', asyncHandler(updateOrgConfig));
router.get('/ingestion-status', asyncHandler(getIngestionStatus));

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

export default router;
