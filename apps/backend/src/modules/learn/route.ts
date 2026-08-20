import { Hono } from 'hono';

import { type AuthVariables, requireAuth } from '@/middleware/auth';
import * as learnService from '@/modules/learn/service';
import { validateUpdateReadingProgress } from '@/modules/learn/validator';

export const learnRoutes = new Hono<{ Variables: AuthVariables }>();

learnRoutes.get('/api/learn/today', requireAuth, async (c) => {
  const user = c.get('user')!;
  const data = await learnService.getToday(user.id);
  return c.json(data);
});

learnRoutes.get('/api/learn/articles/:articleId', requireAuth, async (c) => {
  const user = c.get('user')!;
  const data = await learnService.getLearnArticle(user.id, c.req.param('articleId'));
  return c.json(data);
});

learnRoutes.patch('/api/learn/articles/:articleId/progress', requireAuth, validateUpdateReadingProgress, async (c) => {
  const user = c.get('user')!;
  const progress = await learnService.updateReadingProgress(user.id, c.req.param('articleId'), c.req.valid('json'));
  return c.json(progress);
});
