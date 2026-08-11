import { Hono } from 'hono';

import { redisPing } from '@/lib/redis';
import { type AuthVariables, requireAdmin, requireAuth } from '@/middleware/auth';

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

/** Admin authorization probe — replace with real admin modules when CMS APIs exist. */
routes.get('/api/admin/probe', requireAdmin, (c) => {
  return c.json({ data: { role: c.get('user')?.role } });
});
