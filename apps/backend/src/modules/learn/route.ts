import { Hono } from 'hono';

import { type AuthVariables, requireAdmin, requireAuth } from '@/middleware/auth';
import * as learnService from '@/modules/learn/service';
import {
  validateReplacePracticeItems,
  validateUpdatePracticeAttempt,
  validateUpdateReadingProgress,
} from '@/modules/learn/validator';

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

learnRoutes.get('/api/learn/articles/:articleId/practice', requireAuth, async (c) => {
  const user = c.get('user')!;
  const data = await learnService.getLearnPractice(user.id, c.req.param('articleId'));
  return c.json(data);
});

learnRoutes.post('/api/learn/articles/:articleId/practice/attempts', requireAuth, async (c) => {
  const user = c.get('user')!;
  const attempt = await learnService.startOrResumePracticeAttempt(user.id, c.req.param('articleId'));
  return c.json(attempt);
});

learnRoutes.patch(
  '/api/learn/articles/:articleId/practice/attempts/:attemptId',
  requireAuth,
  validateUpdatePracticeAttempt,
  async (c) => {
    const user = c.get('user')!;
    const attempt = await learnService.updatePracticeAttempt(
      user.id,
      c.req.param('articleId'),
      c.req.param('attemptId'),
      c.req.valid('json'),
    );
    return c.json(attempt);
  },
);

learnRoutes.get('/api/admin/articles/:id/practice-items', requireAdmin, async (c) => {
  const data = await learnService.getAdminPracticeItems(c.req.param('id'));
  return c.json(data);
});

learnRoutes.put('/api/admin/articles/:id/practice-items', requireAdmin, validateReplacePracticeItems, async (c) => {
  const data = await learnService.replaceAdminPracticeItems(c.req.param('id'), c.req.valid('json'));
  return c.json(data);
});
