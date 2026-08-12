import { Redis } from 'ioredis';

import { env } from '@/lib/env';
import { redisLogger } from '@/lib/logger';

let client: Redis | null = null;

// ponytail: ceiling = health-only Redis use; upgrade = Redis store for rate limit (multi-instance)
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
