import express from 'express';
import {authenticateRequest, requireRole} from '../middlewares/auth.middleware.js';
import {asyncHandler} from '../utils/async-handler.js';
import {requireAdminGateSession} from '../controllers/adminGate.controllers.js';
import {getSiteConfig, updateSiteConfig, getWebhookConfig, updateWebhookConfig, rotateWebhookSecret, getWebhookDeliveries, listApiKeys, createApiKey, revokeApiKey, getIngestionStatus, testWebhook, retryWebhookDelivery} from '../controllers/site.controller.js';

const router = express.Router();

router.use(authenticateRequest);

// Readable by any authenticated user
router.get('/me', asyncHandler(getSiteConfig));
router.get('/ingestion-status', asyncHandler(getIngestionStatus));

// Admin-only site config + integrations
router.use(requireRole('org_admin', 'super_admin'));
router.use(requireAdminGateSession);

router.patch('/me', asyncHandler(updateSiteConfig));
router.patch('/me/config', asyncHandler(updateSiteConfig)); // alias for old clients

router.get('/api-keys', asyncHandler(listApiKeys));
router.post('/api-keys', asyncHandler(createApiKey));
router.delete('/api-keys/:keyId', asyncHandler(revokeApiKey));

router.get('/webhooks/config', asyncHandler(getWebhookConfig));
router.put('/webhooks/config', asyncHandler(updateWebhookConfig));
router.post('/webhooks/rotate-secret', asyncHandler(rotateWebhookSecret));
router.get('/webhooks/deliveries', asyncHandler(getWebhookDeliveries));
router.post('/webhooks/test', asyncHandler(testWebhook));
router.post('/webhooks/deliveries/:deliveryId/retry', asyncHandler(retryWebhookDelivery));

export default router;
