import crypto from 'crypto';
import Organisation from '../models/organisation.model.js';
import WebhookDelivery from '../models/webhookDelivery.model.js';
import { dispatchWebhook } from '../queues/webhook.queue.js';

/**
 * Triggers a webhook delivery asynchronously if the organisation has a webhook configured.
 * @param {string|mongoose.Types.ObjectId} orgId 
 * @param {string} eventType 
 * @param {Object} payload 
 */
export const triggerWebhook = async (orgId, eventType, payload) => {
  try {
    const org = await Organisation.findById(orgId).lean();
    
    if (!org || !org.config?.webhookUrl || !org.config?.webhookEnabled) {
      return; // No work to do
    }

    const delivery = await WebhookDelivery.create({
      orgId,
      eventType,
      payload,
      status: 'pending',
    });

    await dispatchWebhook(delivery._id.toString());
  } catch (error) {
    console.error(`[WebhookService] Failed to trigger webhook for event ${eventType}:`, error);
  }
};

/**
 * Validates a webhook URL
 * @param {string} url 
 * @returns {boolean}
 */
export const isValidWebhookUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export default {
  triggerWebhook,
  isValidWebhookUrl,
};
