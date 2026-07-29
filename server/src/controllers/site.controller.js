import crypto from 'crypto';
import { getSite, hashIngestionSecret, generateIngestionSecret } from '../models/site.model.js';
import WebhookDelivery from '../models/webhookDelivery.model.js';
import Event from '../models/event.model.js';
import { ApiError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import { logAudit } from '../utils/audit.js';
import { dispatchWebhook } from '../queues/webhook.queue.js';

export const getSiteConfig = async (req, res) => {
  const site = await getSite();
  const { webhookSecret, ingestionSecret, ...safe } = site.toObject ? site.toObject() : site;
  // Operators get a trimmed view
  if (req.user.role === 'operator') {
    return res.status(200).json(new ApiResponse(200, {
      _id: site._id,
      name: site.name,
      timezone: site.timezone,
      locationLabel: site.locationLabel,
      coordinates: site.coordinates,
    }, 'OK'));
  }
  res.status(200).json(new ApiResponse(200, {
    ...safe,
    webhookSecret: undefined,
    ingestionSecretConfigured: Boolean(site.ingestionSecret),
  }, 'Site retrieved'));
};

export const updateSiteConfig = async (req, res) => {
  const site = await getSite();
  const allowed = ['name', 'timezone', 'locationLabel', 'coordinates', 'siteGeometry', 'webhookUrl', 'webhookEnabled'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) site[key] = req.body[key];
  }
  // nested config-style updates from old settings UI
  if (req.body.siteName) site.name = req.body.siteName;
  if (req.body.industry !== undefined) {
    // ponytail: industry not on Site schema — ignore
  }
  await site.save();
  logAudit(req, 'site.config_updated', { type: 'Site', id: site._id }, req.body);
  const { webhookSecret: _ws, ...safe } = site.toObject();
  res.status(200).json(new ApiResponse(200, safe, 'Site config updated'));
};

export const getWebhookConfig = async (req, res) => {
  const site = await getSite();
  res.status(200).json(new ApiResponse(200, {
    webhookUrl: site.webhookUrl || '',
    webhookEnabled: site.webhookEnabled ?? true,
    webhookSecret: site.webhookSecret || '',
  }, 'Webhook config retrieved successfully'));
};

export const updateWebhookConfig = async (req, res) => {
  const { webhookUrl, webhookEnabled } = req.body;
  const site = await getSite();
  site.webhookUrl = webhookUrl || null;
  if (webhookEnabled !== undefined) site.webhookEnabled = webhookEnabled;
  if (webhookUrl && !site.webhookSecret) {
    site.webhookSecret = crypto.randomBytes(32).toString('hex');
  }
  await site.save();
  logAudit(req, 'site.webhook_updated', { type: 'Site', id: site._id });
  res.status(200).json(new ApiResponse(200, {
    webhookUrl: site.webhookUrl,
    webhookEnabled: site.webhookEnabled,
    webhookSecret: site.webhookSecret,
  }, 'Webhook config updated successfully'));
};

export const rotateWebhookSecret = async (req, res) => {
  const site = await getSite();
  site.webhookSecret = crypto.randomBytes(32).toString('hex');
  await site.save();
  logAudit(req, 'site.webhook_secret_rotated', { type: 'Site', id: site._id });
  res.status(200).json(new ApiResponse(200, { webhookSecret: site.webhookSecret }, 'Webhook secret rotated successfully'));
};

export const getWebhookDeliveries = async (req, res) => {
  const { limit = 50, skip = 0 } = req.query;
  const deliveries = await WebhookDelivery.find()
    .sort({ createdAt: -1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .lean();
  const total = await WebhookDelivery.countDocuments();
  res.status(200).json(new ApiResponse(200, { deliveries, total }, 'Webhook deliveries retrieved successfully'));
};

export const rotateIngestionSecret = async (req, res) => {
  const site = await getSite();
  const raw = generateIngestionSecret();
  site.ingestionSecret = hashIngestionSecret(raw);
  await site.save();
  logAudit(req, 'site.ingestion_secret_rotated', { type: 'Site', id: site._id });
  res.status(200).json(new ApiResponse(200, { ingestionSecret: raw }, 'Ingestion secret rotated — store it now, it will not be shown again'));
};

export const testWebhook = async (req, res) => {
  const site = await getSite();
  if (!site.webhookUrl) throw new ApiError(400, 'No webhook URL configured');

  const payload = {
    event: 'webhook.test',
    timestamp: new Date(),
    message: 'This is a test webhook delivery from Sentinel',
  };
  const payloadString = JSON.stringify(payload);
  let signature = '';
  if (site.webhookSecret) {
    signature = crypto.createHmac('sha256', site.webhookSecret).update(payloadString).digest('hex');
  }

  try {
    const response = await fetch(site.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentinel-Signature': signature,
        'X-Sentinel-Event': 'webhook.test',
      },
      body: payloadString,
      signal: AbortSignal.timeout(10000),
    });
    const responseText = await response.text();
    res.status(200).json(new ApiResponse(200, {
      success: response.ok,
      statusCode: response.status,
      responseBody: responseText.substring(0, 500),
    }, response.ok ? 'Test webhook delivered successfully' : 'Endpoint returned non-2xx'));
  } catch (error) {
    res.status(200).json(new ApiResponse(200, {
      success: false,
      statusCode: 0,
      responseBody: error.message.substring(0, 500),
    }, 'Test webhook delivery failed'));
  }
};

export const retryWebhookDelivery = async (req, res) => {
  const delivery = await WebhookDelivery.findById(req.params.deliveryId);
  if (!delivery) throw new ApiError(404, 'Delivery not found');
  if (delivery.status === 'delivered') {
    throw new ApiError(400, 'Delivery already succeeded — retry not needed');
  }
  delivery.status = 'pending';
  delivery.nextRetryAt = null;
  await delivery.save();
  await dispatchWebhook(delivery._id.toString());
  res.status(200).json(new ApiResponse(200, { queued: true, deliveryId: delivery._id }, 'Delivery queued for retry'));
};

export const getIngestionStatus = async (req, res) => {
  const latestEvent = await Event.findOne().sort({ timestamp: -1 }).select('timestamp').lean();
  res.status(200).json(new ApiResponse(200, {
    active: Boolean(latestEvent),
    lastReceivedAt: latestEvent ? latestEvent.timestamp : null,
  }, 'Ingestion status retrieved'));
};
