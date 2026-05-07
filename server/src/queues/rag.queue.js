import { Queue } from 'bullmq';
import { getRedis } from '../db/redis.js';

const RAG_QUEUE_NAME = 'rag-indexing';
let ragQueue = null;

export const getRagQueue = () => {
  if (!ragQueue) {
    const redisClient = getRedis();
    if (!redisClient) {
      throw new Error('Redis client not initialized. Call connectRedis() first.');
    }

    ragQueue = new Queue(RAG_QUEUE_NAME, {
      connection: redisClient,
      defaultJobOptions: {
        removeOnComplete: true,
      },
    });

    ragQueue.on('error', (error) => {
      console.error('[RagQueue] Error:', error);
    });
  }

  return ragQueue;
};

export const dispatchIndexingJob = async (ragDocumentId, orgId) => {
  try {
    const queue = getRagQueue();

    const job = await queue.add(
      'index-document',
      { ragDocumentId: ragDocumentId.toString(), orgId: orgId.toString() },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    console.log(`[RagQueue] Job dispatched: ${job.id} | Document: ${ragDocumentId}`);
    return job;
  } catch (error) {
    console.error('[RagQueue] Failed to dispatch indexing job:', error);
    throw error;
  }
};

export const closeRagQueue = async () => {
  if (ragQueue) {
    await ragQueue.close();
    ragQueue = null;
  }
};

export default { getRagQueue, dispatchIndexingJob, closeRagQueue };
