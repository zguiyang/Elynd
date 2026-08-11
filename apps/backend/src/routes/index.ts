import { Hono } from 'hono';

import { redisPing } from '@/lib/redis';

/** Route composition entry — mount feature modules here as they are added. */
export const routes = new Hono();

routes.get('/api/health', async (c) => {
  const redis = await redisPing();
  return c.json({ ok: true, redis });
});
