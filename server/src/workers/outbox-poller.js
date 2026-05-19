import OutboxEvent from '../models/outboxEvent.model.js';
import WebhookDelivery from '../models/webhookDelivery.model.js';
import { logAudit } from '../utils/audit.js';

const OUTBOX_ENABLED = process.env.OUTBOX_ENABLED === 'true';
const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 10;

let pollerInterval = null;

const dispatchWebhookQueue = async (deliveryId) => {
  const { getWebhookQueue } = await import('../queues/webhook.queue.js');
  const queue = getWebhookQueue();
  await queue.add('deliver', { deliveryId: deliveryId.toString() }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: true,
  });
};

const processBatch = async () => {
  if (!OUTBOX_ENABLED) return;

  try {
    // Claim rows atomically — findOneAndUpdate prevents concurrent pollers picking same row
    const claimed = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const row = await OutboxEvent.findOneAndUpdate(
        { status: 'pending' },
        { $set: { status: 'dispatched', dispatchedAt: new Date() } },
        { sort: { createdAt: 1 }, new: false }
      );
      if (!row) break;
      claimed.push(row);
    }

    for (const row of claimed) {
      try {
        const delivery = await WebhookDelivery.create({
          orgId: row.orgId,
          eventType: row.eventType,
          payload: row.payload,
          status: 'pending',
          attempts: 0,
        });
        await dispatchWebhookQueue(delivery._id);
      } catch (err) {
        // Failed to dispatch — revert to pending with backoff counter
        const attempts = (row.attempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await OutboxEvent.findByIdAndUpdate(row._id, {
            status: 'failed',
            lastError: err.message,
            attempts,
          });
          // Audit log for permanently failed outbox row
          try {
            await logAudit(null, 'outbox.permanent_failure', { type: 'OutboxEvent', id: row._id }, {
              eventType: row.eventType,
              attempts,
              error: err.message,
            });
          } catch {}
        } else {
          await OutboxEvent.findByIdAndUpdate(row._id, {
            status: 'pending',
            lastError: err.message,
            attempts,
          });
        }
      }
    }
  } catch (err) {
    console.error('[OutboxPoller] Poll error:', err.message);
  }
};

export const startOutboxPoller = () => {
  if (!OUTBOX_ENABLED) {
    console.log('[OutboxPoller] Disabled (OUTBOX_ENABLED != true)');
    return;
  }
  if (pollerInterval) return;
  pollerInterval = setInterval(processBatch, POLL_INTERVAL_MS);
  console.log(`[OutboxPoller] Started (interval: ${POLL_INTERVAL_MS}ms)`);
};

export const stopOutboxPoller = () => {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log('[OutboxPoller] Stopped');
  }
};
