import { Hono } from 'hono';

import { type AuthVariables, requireAdmin, requireAuth } from '@/middleware/auth';
import * as articleAudioService from '@/modules/article-audio/service';
import { validateGenerateArticleAudio, validateReaderArticleAudioQuery } from '@/modules/article-audio/validator';

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

/** Reader playback — published article track only. */
articleAudioRoutes.get(
  '/api/reader/articles/:articleId/audio',
  requireAuth,
  validateReaderArticleAudioQuery,
  async (c) => {
    return c.json(
      await articleAudioService.getPublishedArticleAudioTrack(c.req.param('articleId'), c.req.valid('query').role),
    );
  },
);
