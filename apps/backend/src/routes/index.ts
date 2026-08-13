import { Hono } from 'hono';

import { redisPing } from '@/lib/redis';
import { type AuthVariables, requireAdmin, requireAuth } from '@/middleware/auth';
import { aiRoutes } from '@/modules/ai/route';
import { articlesRoutes } from '@/modules/articles/route';
import { assistRoutes } from '@/modules/assist/route';
import { conversationsRoutes } from '@/modules/conversations/route';
import { learnRoutes } from '@/modules/learn/route';
import { llmConfigRoutes } from '@/modules/llm-config/route';

/** Route composition entry — mount feature modules here as they are added. */
export const routes = new Hono<{ Variables: AuthVariables }>();

routes.get('/api/health', async (c) => {
  const redis = await redisPing();
  return c.json({ ok: true, redis });
});

/** Protected probe — proves BA session middleware on Hono (not Next soft gate). */
routes.get('/api/me', requireAuth, (c) => {
  return c.json(c.get('user'));
});

/** Admin authorization probe — kept for auth smoke tests alongside CMS routes. */
routes.get('/api/admin/probe', requireAdmin, (c) => {
  return c.json({ role: c.get('user')?.role });
});

routes.route('/', articlesRoutes);
routes.route('/', learnRoutes);
routes.route('/', llmConfigRoutes);
routes.route('/', aiRoutes);
routes.route('/', assistRoutes);
routes.route('/', conversationsRoutes);
