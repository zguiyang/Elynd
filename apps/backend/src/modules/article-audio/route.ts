import { Hono } from 'hono';

import { type AuthVariables, requireAdmin } from '@/middleware/auth';
import * as articleAudioService from '@/modules/article-audio/service';
import { validateGenerateArticleAudio } from '@/modules/article-audio/validator';

export const articleAudioRoutes = new Hono<{ Variables: AuthVariables }>();

articleAudioRoutes.get('/api/admin/articles/:id/audio', requireAdmin, async (c) => {
  return c.json(await articleAudioService.getArticleAudio(c.req.param('id')));
});

articleAudioRoutes.post(
  '/api/admin/articles/:id/audio/generate',
  requireAdmin,
  validateGenerateArticleAudio,
  async (c) => {
    const user = c.get('user');
    return c.json(
      await articleAudioService.generateArticleAudio(c.req.param('id'), c.req.valid('json'), {
        userId: user?.id,
      }),
    );
  },
);
