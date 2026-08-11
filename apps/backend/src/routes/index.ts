import { Hono } from 'hono';

import { redisPing } from '@/lib/redis';
import { type AuthVariables, requireAdmin, requireAuth } from '@/middleware/auth';
import { articlesRoutes } from '@/modules/articles/route';

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

/** Admin authorization probe — kept for auth smoke tests alongside CMS routes. */
routes.get('/api/admin/probe', requireAdmin, (c) => {
  return c.json({ data: { role: c.get('user')?.role } });
});

routes.route('/', articlesRoutes);
