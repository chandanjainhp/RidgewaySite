import Redis from 'ioredis';
import { Worker } from 'bullmq';
import { runInvestigation } from '../ai/agent.js';
import { checkNightComplete } from '../services/investigation.service.js';
import Investigation from '../models/investigation.model.js';
import WebhookDelivery from '../models/webhookDelivery.model.js';
import Organisation from '../models/organisation.model.js';
import OutboxEvent from '../models/outboxEvent.model.js';
import { startOutboxPoller, stopOutboxPoller } from '../workers/outbox-poller.js';

const OUTBOX_ENABLED = process.env.OUTBOX_ENABLED === 'true';
import crypto from 'crypto';
import fs from 'fs/promises';

/**
 * BullMQ Worker for investigation queue
 * Processes investigation jobs asynchronously with resource limits
 */

let investigationWorker = null;
let webhookWorker = null;
let correlationWorker = null;
let briefingWorker = null;
let workerRedisConnection = null;

/**
 * Create separate Redis connection for BullMQ worker
 * BullMQ requires its own connection separate from the main app
 */
const createWorkerRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: true,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      if (times > 10) {
        console.error('[Worker] Max retries exceeded');
        return null;
      }
      return delay;
    },
  });

  connection.on('error', (err) => {
    console.error('[Worker] Redis connection error:', err.message);
  });

  connection.on('connect', () => {
    console.log('[Worker] Redis worker connection established');
  });

  return connection;
};

/**
 * Start the investigation worker
 * Called after database connections are established
 * @returns {Promise<void>}
 */
export const startWorker = async () => {
  try {
    if (investigationWorker) {
      console.warn('[Worker] Worker already started');
      return;
    }

    // Create worker Redis connection
    workerRedisConnection = createWorkerRedisConnection();

    // Create BullMQ worker
    investigationWorker = new Worker(
      'investigations',
      async (job) => {
        const { investigationId, incidentId, nightDate, orgId } = job.data;
        const jobId = job.id;

        console.log(
          `[Worker] Processing job ${jobId} for incident ${incidentId}`
        );

        let investigation = null;

        try {
          // ========== UPDATE STATUS TO RUNNING ==========
          investigation = await Investigation.findById(investigationId);
          if (!investigation) {
            throw new Error(`Investigation not found: ${investigationId}`);
          }

          investigation.status = 'running';
          investigation.jobId = jobId;
          await investigation.save();
          console.log(`[Worker] Investigation status updated to running: ${incidentId}`);

          // ========== RUN INVESTIGATION ==========
          console.log('[Worker] Starting investigation now:', incidentId);

          const investigationResult = await runInvestigation(
            investigation.incidentId,
            jobId,
            investigation
          );

          console.log(
            `[Worker] Investigation completed for job ${jobId}`,
            investigationResult
          );

          // ========== UPDATE INVESTIGATION WITH RESULTS ==========
          investigation.status = 'complete';
          investigation.classification = investigationResult.classification;
          investigation.toolCallSequence = investigationResult.toolCallSequence;
          investigation.evidenceChain = investigationResult.evidenceChain;
          investigation.tokenUsage = investigationResult.tokenUsage;
          investigation.totalToolCalls = investigationResult.toolCallSequence?.length || 0;
          investigation.durationMs = investigationResult.durationMs;
          investigation.agentModel = investigationResult.agentModel;
          await investigation.save();

          console.log(`[Worker] Investigation record updated: ${incidentId}`);

          // ========== WEBHOOK TRIGGER ==========
          const webhookPayload = {
            investigationId,
            incidentId,
            status: 'complete',
            classification: investigationResult.classification,
            timestamp: new Date(),
          };
          if (OUTBOX_ENABLED) {
            await OutboxEvent.create({ orgId, eventType: 'investigation.completed', payload: webhookPayload, status: 'pending' });
          } else {
            const { triggerWebhook } = await import('../services/webhook.service.js');
            triggerWebhook(orgId, 'investigation.completed', webhookPayload);
          }

          // ========== CHECK IF NIGHT IS COMPLETE ==========
          const nightCheckResult = await checkNightComplete(nightDate, { orgId });
          console.log(
            `[Worker] Night completion check:`,
            nightCheckResult
          );

          // ========== RETURN RESULT ==========
          return {
            jobId,
            incidentId,
            status: 'completed',
            classification: investigationResult.classification,
            nightComplete: nightCheckResult.isComplete,
          };
        } catch (error) {
          console.error(
            `[Worker] Job failed - ${jobId} | Incident: ${incidentId}:`,
            error
          );

          // ========== ERROR HANDLING - UPDATE STATUS TO FAILED ==========
          try {
            const failedInvestigation = await Investigation.findById(investigationId);
            if (failedInvestigation) {
              failedInvestigation.status = 'failed';
              failedInvestigation.failureReason = error.message;
              await failedInvestigation.save();

              console.log(
                `[Worker] Investigation status updated to failed: ${incidentId}`
              );
            }
          } catch (updateError) {
            console.error(
              `[Worker] Failed to update investigation status on error:`,
              updateError.message
            );
          }

          // Re-throw to BullMQ for retry handling
          throw error;
        }
      },
      {
        connection: workerRedisConnection,
        concurrency: 3, // Run 3 investigations in parallel
        limiter: {
          max: 5, // Max 5 jobs
          duration: 60000, // Per minute (respect API rate limits)
        },
      }
    );

    // Log worker events
    investigationWorker.on('completed', (job, result) => {
      console.log(
        `[Worker] ✓ Job completed: ${job.id}`,
        result
      );
    });

    investigationWorker.on('failed', (job, error) => {
      console.error(
        `[Worker] ✗ Job failed: ${job.id} - ${error.message}`
      );
    });

    investigationWorker.on('error', (error) => {
      console.error(`[Worker] Worker error:`, error.message);
    });

    console.log('[Worker] ✓ Investigation worker started (concurrency: 3, limiter: 5/min)');

    // ==========================================
    // START WEBHOOK WORKER
    // ==========================================
    webhookWorker = new Worker(
      'webhooks',
      async (job) => {
        const { deliveryId } = job.data;
        console.log(`[WebhookWorker] Processing delivery ${deliveryId}`);

        const delivery = await WebhookDelivery.findById(deliveryId);
        if (!delivery) {
          throw new Error(`WebhookDelivery not found: ${deliveryId}`);
        }

        if (delivery.status === 'delivered') {
          return { status: 'already_delivered' };
        }

        const org = await Organisation.findById(delivery.orgId).lean();
        if (!org || !org.config?.webhookUrl || !org.config?.webhookEnabled) {
          delivery.status = 'failed';
          delivery.responseBody = 'Webhook URL not configured or disabled';
          await delivery.save();
          return { status: 'skipped' };
        }

        delivery.attempts += 1;
        
        try {
          // Generate HMAC signature
          const payloadString = JSON.stringify(delivery.payload);
          let signature = '';
          if (org.config.webhookSecret) {
            signature = crypto
              .createHmac('sha256', org.config.webhookSecret)
              .update(payloadString)
              .digest('hex');
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(org.config.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Sentinel-Event': delivery.eventType,
              'X-Sentinel-Delivery': delivery._id.toString(),
              ...(signature && { 'X-Sentinel-Signature': `sha256=${signature}` }),
            },
            body: payloadString,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const responseText = await response.text();
          delivery.responseStatus = response.status;
          delivery.responseBody = responseText.substring(0, 1000); // Truncate long responses

          if (response.ok) {
            delivery.status = 'delivered';
            delivery.deliveredAt = new Date();
            await delivery.save();
            console.log(`[WebhookWorker] Successfully delivered ${deliveryId}`);
            return { status: 'delivered', statusCode: response.status };
          } else {
            throw new Error(`HTTP Error ${response.status}: ${responseText}`);
          }

        } catch (error) {
          delivery.responseBody = error.message;
          
          if (delivery.attempts >= 5) {
            delivery.status = 'failed';
            console.error(`[WebhookWorker] Delivery ${deliveryId} failed permanently after 5 attempts`);
          } else {
            // Schedule next retry based on BullMQ's exponential backoff
            // 30s, 60s, 120s, 240s...
            // To exactly match the prompt: 30s, 2m, 10m, 1h. 
            // BullMQ exponential backoff defaults to baseDelay * 2^attempt.
            // We'll let BullMQ handle the exact timing but calculate nextRetryAt
            const delays = [30000, 120000, 600000, 3600000];
            const delay = delays[delivery.attempts - 1] || 3600000;
            delivery.nextRetryAt = new Date(Date.now() + delay);
          }
          
          await delivery.save();
          
          if (delivery.status !== 'failed') {
            throw error; // Throw so BullMQ retries
          }
          return { status: 'failed' };
        }
      },
      {
        connection: workerRedisConnection,
        concurrency: 3,
      }
    );

    webhookWorker.on('completed', (job, result) => {
      console.log(`[WebhookWorker] ✓ Job completed: ${job.id}`, result);
    });

    webhookWorker.on('failed', (job, error) => {
      console.error(`[WebhookWorker] ✗ Job failed: ${job.id} - ${error.message}`);
    });

    console.log('[Worker] ✓ Webhook worker started (concurrency: 3)');

    // ==========================================
    // START CORRELATION WORKER
    // ==========================================
    correlationWorker = new Worker(
      'correlation',
      async (job) => {
        const { orgId, nightDate } = job.data;
        console.log(`[CorrelationWorker] Running correlation for ${orgId} on ${nightDate}`);
        const { correlateNightEvents } = await import('../services/correlation.service.js');
        const incidentIds = await correlateNightEvents(orgId, nightDate);
        return { status: 'correlated', orgId, nightDate, incidentsCreated: incidentIds.length };
      },
      {
        connection: workerRedisConnection,
        concurrency: 1,
      }
    );

    correlationWorker.on('completed', (job, result) => {
      console.log(`[CorrelationWorker] ✓ Job completed: ${job.id}`, result);
    });

    correlationWorker.on('failed', (job, error) => {
      console.error(`[CorrelationWorker] ✗ Job failed: ${job.id} - ${error.message}`);
    });

    console.log('[Worker] ✓ Correlation worker started (concurrency: 1)');

    // ==========================================
    // START BRIEFING WORKER
    // ==========================================
    briefingWorker = new Worker(
      'briefings',
      async (job) => {
        const { orgId } = job.data;
        const nightDate = new Date();
        nightDate.setDate(nightDate.getDate() - 1);
        const nightDateString = nightDate.toISOString().split("T")[0];

        console.log(`[BriefingWorker] Finalizing briefing for ${orgId} on ${nightDateString}`);

        const { correlateNightEvents } = await import('../services/correlation.service.js');
        const { buildBriefing } = await import('../services/briefing.service.js');
        const Investigation = (await import('../models/investigation.model.js')).default;
        const Briefing = (await import('../models/briefing.model.js')).default;

        // 1. One final correlation
        await correlateNightEvents(orgId, nightDateString);

        // 2. Pre-create generating briefing
        let briefing = await Briefing.create({
          briefingId: `BR-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          orgId,
          nightDate: nightDateString,
          status: 'generating',
        });

        // 3. Wait for in-flight investigations (max 10 min)
        const maxWaitMs = 10 * 60 * 1000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
          const inFlight = await Investigation.countDocuments({
            orgId,
            nightDate: nightDateString,
            status: { $in: ['queued', 'running'] },
          });
          if (inFlight === 0) break;
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        const remaining = await Investigation.countDocuments({
          orgId,
          nightDate: nightDateString,
          status: { $in: ['queued', 'running'] },
        });

        if (remaining > 0) {
          briefing.status = 'failed';
          await briefing.save();
          throw new Error('Investigations did not complete within 10 minutes');
        }

        try {
          await Briefing.deleteOne({ _id: briefing._id });
          await buildBriefing(orgId, nightDateString);
          return { status: 'draft', orgId, nightDateString };
        } catch (e) {
          briefing = await Briefing.create({
            briefingId: `BR-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            orgId,
            nightDate: nightDateString,
            status: 'failed',
          });
          throw e;
        }
      },
      {
        connection: workerRedisConnection,
        concurrency: 1,
      }
    );

    briefingWorker.on('completed', (job, result) => {
      console.log(`[BriefingWorker] ✓ Job completed: ${job.id}`, result);
    });

    briefingWorker.on('failed', (job, error) => {
      console.error(`[BriefingWorker] ✗ Job failed: ${job.id} - ${error.message}`);
    });

    console.log('[Worker] ✓ Briefing worker started (concurrency: 1)');

    // ==========================================
    // START OUTBOX POLLER
    // ==========================================
    startOutboxPoller();

  } catch (error) {
    console.error('[Worker] Failed to start worker:', error);
    throw error;
  }
};

/**
 * Stop the investigation worker
 * Graceful shutdown of worker and Redis connection
 * @returns {Promise<void>}
 */
export const stopWorker = async () => {
  try {
    if (investigationWorker) {
      await investigationWorker.close();
      investigationWorker = null;
      console.log('[Worker] ✓ Investigation worker stopped');
    }

    if (webhookWorker) {
      await webhookWorker.close();
      webhookWorker = null;
      console.log('[Worker] ✓ Webhook worker stopped');
    }

    if (correlationWorker) {
      await correlationWorker.close();
      correlationWorker = null;
      console.log('[Worker] ✓ Correlation worker stopped');
    }

    if (briefingWorker) {
      await briefingWorker.close();
      briefingWorker = null;
      console.log('[Worker] ✓ Briefing worker stopped');
    }

    stopOutboxPoller();

    if (workerRedisConnection) {
      await workerRedisConnection.quit();
      workerRedisConnection = null;
      console.log('[Worker] ✓ Worker Redis connection closed');
    }
  } catch (error) {
    console.error('[Worker] Error stopping worker:', error.message);
    throw error;
  }
};

export default {
  startWorker,
  stopWorker,
};
