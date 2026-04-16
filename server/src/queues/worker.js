import Redis from 'ioredis';
import { Worker } from 'bullmq';
import { runInvestigation } from '../ai/agent.js';
import { checkNightComplete } from '../services/investigation.service.js';
import Investigation from '../models/investigation.model.js';
import { setAgentState } from '../db/redis.js';

/**
 * BullMQ Worker for investigation queue
 * Processes investigation jobs asynchronously with resource limits
 */

let investigationWorker = null;
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
        const { incidentId, nightDate } = job.data;
        const jobId = job.id;

        console.log(
          `[Worker] Processing job ${jobId} for incident ${incidentId}`
        );

        let investigation = null;

        try {
          // ========== UPDATE STATUS TO RUNNING ==========
          investigation = await Investigation.findById(incidentId);
          if (!investigation) {
            throw new Error(`Investigation not found: ${incidentId}`);
          }

          investigation.status = 'running';
          investigation.jobId = jobId;
          await investigation.save();
          console.log(`[Worker] Investigation status updated to running: ${incidentId}`);

          // ========== DEFINE EMIT PROGRESS CALLBACK ==========
          const emitProgress = async (progressEvent) => {
            try {
              // Update BullMQ job progress
              await job.updateProgress(progressEvent);

              // Save progress event to Redis for SSE clients to replay
              await setAgentState(jobId, progressEvent);

              console.log(
                `[Worker] Progress emitted for job ${jobId}: ${progressEvent.type}`
              );
            } catch (error) {
              console.error(
                `[Worker] Error emitting progress for job ${jobId}:`,
                error.message
              );
              // Don't throw — allow investigation to continue even if progress emit fails
            }
          };

          // ========== RUN INVESTIGATION ==========
          const investigationResult = await runInvestigation(
            investigation.incidentId,
            jobId,
            emitProgress
          );

          console.log(
            `[Worker] Investigation completed for job ${jobId}`,
            investigationResult
          );

          // ========== UPDATE INVESTIGATION WITH RESULTS ==========
          investigation.status = 'complete';
          investigation.finalClassification = investigationResult.finalClassification;
          investigation.toolCallSequence = investigationResult.toolCallSequence;
          investigation.evidenceChain = investigationResult.evidenceChain;
          investigation.tokenUsage = investigationResult.tokenUsage;
          investigation.totalToolCalls = investigationResult.toolCallSequence?.length || 0;
          investigation.durationMs = investigationResult.durationMs;
          investigation.agentModel = investigationResult.agentModel;
          await investigation.save();

          console.log(`[Worker] Investigation record updated: ${incidentId}`);

          // ========== CHECK IF NIGHT IS COMPLETE ==========
          const nightCheckResult = await checkNightComplete(nightDate);
          console.log(
            `[Worker] Night completion check:`,
            nightCheckResult
          );

          // ========== RETURN RESULT ==========
          return {
            jobId,
            incidentId,
            status: 'completed',
            classification: investigationResult.finalClassification,
            nightComplete: nightCheckResult.isComplete,
          };
        } catch (error) {
          console.error(
            `[Worker] Job failed - ${jobId} | Incident: ${incidentId}:`,
            error
          );

          // ========== ERROR HANDLING - UPDATE STATUS TO FAILED ==========
          try {
            const failedInvestigation = await Investigation.findById(incidentId);
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
