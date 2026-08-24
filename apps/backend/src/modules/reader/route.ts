import { Hono } from 'hono';

import { type AuthVariables, requireAuth } from '@/middleware/auth';
import * as readerService from '@/modules/reader/service';
import { validateUpdateReadingProgress } from '@/modules/reader/validator';

export const readerRoutes = new Hono<{ Variables: AuthVariables }>();

readerRoutes.get('/api/reader/articles/:articleId', async (c) => {
  const user = c.get('user');
  const data = user
    ? await readerService.getReaderSession(user.id, c.req.param('articleId'))
    : await readerService.getPublicReaderSession(c.req.param('articleId'));
  return c.json(data);
});

readerRoutes.patch(
  '/api/reader/articles/:articleId/progress',
  requireAuth,
  validateUpdateReadingProgress,
  async (c) => {
    const user = c.get('user')!;
    const progress = await readerService.updateReadingProgress(user.id, c.req.param('articleId'), c.req.valid('json'));
    return c.json(progress);
  },
);
