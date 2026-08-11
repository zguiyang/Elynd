import { Hono } from 'hono';

import { redisPing } from '@/lib/redis';
import { type AuthVariables, requireAuth } from '@/middleware/auth';

/** Route composition entry — mount feature modules here as they are added. */
export const routes = new Hono<{ Variables: AuthVariables }>();

routes.get('/api/health', async (c) => {
  const redis = await redisPing();
  return c.json({ ok: true, redis });
});

/** Protected probe — proves BA session middleware on Hono (not Next soft gate). */
routes.get('/api/me', requireAuth, (c) => {
  return c.json({ data: c.get('user') });
});
