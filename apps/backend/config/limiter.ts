import { defineConfig, stores } from '@adonisjs/limiter';

import env from '#start/env';

const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE'),
  stores: {
    /**
     * Redis store for distributed rate limits (login brute-force, etc.).
     * Prefer a dedicated Redis DB in production when sharing a host.
     */
    redis: stores.redis({
      connectionName: 'main',
    }),

    /**
     * Memory store for tests / single-process experiments.
     */
    memory: stores.memory({}),
  },
});

export default limiterConfig;

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
