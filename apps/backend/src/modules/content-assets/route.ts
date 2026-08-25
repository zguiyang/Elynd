import { Hono } from 'hono';

import { type AuthVariables, requireAdmin } from '@/middleware/auth';
import * as contentAssetsService from '@/modules/content-assets/service';
import { validateGeneratePartAudio } from '@/modules/content-assets/validator';

export const contentAssetsRoutes = new Hono<{ Variables: AuthVariables }>();

contentAssetsRoutes.get('/api/admin/parts/:partId/audio', requireAdmin, async (c) => {
  return c.json(await contentAssetsService.getPartAudio(c.req.param('partId')));
});

contentAssetsRoutes.post(
  '/api/admin/parts/:partId/audio/generate',
  requireAdmin,
  validateGeneratePartAudio,
  async (c) => {
    const user = c.get('user');
    return c.json(
      await contentAssetsService.generatePartAudio(c.req.param('partId'), c.req.valid('json'), {
        userId: user?.id,
      }),
    );
  },
);
