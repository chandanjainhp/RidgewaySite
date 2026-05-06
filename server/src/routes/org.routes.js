import express from 'express';
import { authenticateRequest, requireRole, scopeToOrg } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { 
  inviteOperator, 
  listOrgMembers,
  getWebhookConfig,
  updateWebhookConfig,
  rotateWebhookSecret,
  getWebhookDeliveries
} from '../controllers/org.controller.js';

const router = express.Router();

router.use(authenticateRequest);
router.use(scopeToOrg);
router.use(requireRole('org_admin'));

router.post('/users/invite', asyncHandler(inviteOperator));
router.get('/users', asyncHandler(listOrgMembers));

// Webhook management routes (org_admin only)
router.get('/webhooks/config', asyncHandler(getWebhookConfig));
router.put('/webhooks/config', asyncHandler(updateWebhookConfig));
router.post('/webhooks/rotate-secret', asyncHandler(rotateWebhookSecret));
router.get('/webhooks/deliveries', asyncHandler(getWebhookDeliveries));

export default router;
