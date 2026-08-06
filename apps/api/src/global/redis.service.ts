import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { resolveRedisOptions } from './redis.options.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const options = resolveRedisOptions({
      REDIS_HOST: config.get<string>('REDIS_HOST') ?? process.env.REDIS_HOST,
      REDIS_PORT: config.get<string>('REDIS_PORT') ?? process.env.REDIS_PORT,
    });

    this.logger.log(`Connecting to Redis at ${options.host}:${options.port}...`);
    this.client = new Redis({
      host: options.host,
      port: options.port,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis client error: ${error.message}`);
    });
  }

  /** Shared ioredis client for cache / cooldown / future queues. */
  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
