import express from 'express';
import {authenticateRequest, requireRole} from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validation.middleware.js';
import {siteValidator} from '../validators/index.js';
import {asyncHandler} from '../utils/async-handler.js';
import {requireAdminGateSession} from '../controllers/adminGate.controllers.js';
import {getSiteConfig, updateSiteConfig, getWebhookConfig, updateWebhookConfig, rotateWebhookSecret, rotateIngestionSecret, getWebhookDeliveries, getIngestionStatus, testWebhook, retryWebhookDelivery} from '../controllers/site.controller.js';

const router = express.Router();

router.use(authenticateRequest);

// Readable by any authenticated user
router.get('/me', asyncHandler(getSiteConfig));
router.get('/ingestion-status', asyncHandler(getIngestionStatus));

// Admin-only site config + integrations
router.use(requireRole('org_admin', 'super_admin'));
router.use(requireAdminGateSession);

router.patch('/me', validate(siteValidator.updateSiteConfigSchema), asyncHandler(updateSiteConfig));
router.patch('/me/config', validate(siteValidator.updateSiteConfigSchema), asyncHandler(updateSiteConfig)); // alias for old clients

router.post('/rotate-secret', asyncHandler(rotateIngestionSecret));

router.get('/webhooks/config', asyncHandler(getWebhookConfig));
router.put('/webhooks/config', validate(siteValidator.updateWebhookConfigSchema), asyncHandler(updateWebhookConfig));
router.post('/webhooks/rotate-secret', asyncHandler(rotateWebhookSecret));
router.get('/webhooks/deliveries', validate(siteValidator.webhookDeliveriesQuerySchema, 'query'), asyncHandler(getWebhookDeliveries));
router.post('/webhooks/test', asyncHandler(testWebhook));
router.post('/webhooks/deliveries/:deliveryId/retry', validate(siteValidator.deliveryIdParamSchema, 'params'), asyncHandler(retryWebhookDelivery));

export default router;
