import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import type { PingJobData } from '@/jobs/ping';
import { JOB_PING } from '@/jobs/ping';
import { env } from '@/lib/env';
import { queueLogger } from '@/lib/logger';

export const QUEUE_NAME = 'elynd';

const jobCleanup = { removeOnComplete: 100, removeOnFail: 100 } as const;

let connection: Redis | null = null;
let queue: Queue | null = null;

/** Dedicated BullMQ Redis client. Do not reuse `getRedis()`. */
export function getQueueConnection(): Redis {
  if (connection) {
    return connection;
  }

  connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (err) => {
    queueLogger.error({ err }, 'Queue Redis connection error');
  });
  return connection;
}

export function getQueue(): Queue {
  if (queue) {
    return queue;
  }

  queue = new Queue(QUEUE_NAME, {
    connection: getQueueConnection(),
    defaultJobOptions: jobCleanup,
  });
  return queue;
}

export async function enqueue(name: string, data: unknown): Promise<string> {
  const job = await getQueue().add(name, data);
  if (!job.id) {
    throw new Error(`Job ${name} was added without an id`);
  }
  return job.id;
}

export async function enqueuePing(data?: PingJobData): Promise<string> {
  const payload: PingJobData = data ?? { requestedAt: new Date().toISOString() };
  return enqueue(JOB_PING, payload);
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
