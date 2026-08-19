import { Redis } from 'ioredis';

import { env } from '@/lib/env';
import { redisLogger } from '@/lib/logger';

let client: Redis | null = null;

// Health / cache client. BullMQ uses a separate connection in `lib/queue.ts`.
export function getRedis(): Redis {
  if (client) {
    return client;
  }

  redisLogger.info('Connecting to Redis...');
  client = new Redis(env.REDIS_URL);

  client.on('connect', () => {
    redisLogger.info('Connected to Redis');
  });

  client.on('error', (err) => {
    redisLogger.error({ err }, 'Redis connection error');
  });

  return client;
}

export async function redisPing(): Promise<string> {
  return getRedis().ping();
}
