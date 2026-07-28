import { getSite } from '../models/site.model.js';
import WebhookDelivery from '../models/webhookDelivery.model.js';
import { dispatchWebhook } from '../queues/webhook.queue.js';

/**
 * Queue a webhook delivery if Site has a webhook configured.
 */
export const triggerWebhook = async (eventType, payload) => {
  try {
    const site = await getSite();

    if (!site.webhookUrl || !site.webhookEnabled) {
      return;
    }

    const delivery = await WebhookDelivery.create({
      eventType,
      payload,
      status: 'pending',
    });

    await dispatchWebhook(delivery._id.toString());
  } catch (error) {
    console.error(`[WebhookService] Failed to trigger webhook for event ${eventType}:`, error);
  }
};

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
