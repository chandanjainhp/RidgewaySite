import { Queue } from 'bullmq';
import { getRedis } from '../db/redis.js';

let briefingQueue = null;

export const getBriefingQueue = () => {
  if (!briefingQueue) {
    const redisClient = getRedis();
    if (!redisClient) throw new Error('Redis client not initialized.');

    briefingQueue = new Queue('briefings', {
      connection: redisClient,
      defaultJobOptions: { removeOnComplete: true },
    });
  }
  return briefingQueue;
};

export const scheduleBriefingFinalisation = async (orgId, timeString = '05:30', timezone = 'UTC') => {
  const queue = getBriefingQueue();
  const [hour, minute] = timeString.split(':');
  
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id === `briefing:${orgId}`) {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  await queue.add(
    'finalizeBriefing',
    { orgId },
    {
      repeat: {
        pattern: `${minute} ${hour} * * *`,
        tz: timezone
      },
      jobId: `briefing:${orgId}`
    }
  );
};

export default { getBriefingQueue, scheduleBriefingFinalisation };
