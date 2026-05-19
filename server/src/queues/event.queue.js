import { Queue } from 'bullmq';
import { getRedis } from '../db/redis.js';

let correlationQueue = null;

export const getCorrelationQueue = () => {
  if (!correlationQueue) {
    const redisClient = getRedis();
    if (!redisClient) {
      throw new Error('Redis client not initialized.');
    }

    correlationQueue = new Queue('correlation', {
      connection: redisClient,
      defaultJobOptions: {
        removeOnComplete: true,
      },
    });
  }
  return correlationQueue;
};

export default { getCorrelationQueue };
