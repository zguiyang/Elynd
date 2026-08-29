import { Hono } from 'hono';

import { readerPartAudioQuerySchema } from '@gloaming/shared/api/reader';

import { type AuthVariables, requireAuth } from '@/middleware/auth';
import * as readerService from '@/modules/reader/service';
import { validateUpdateReadingState } from '@/modules/reader/validator';

export const readerRoutes = new Hono<{ Variables: AuthVariables }>();

readerRoutes.get('/api/reader/works/:workId', async (c) => {
  const user = c.get('user');
  const preferredPartId = c.req.query('partId')?.trim() || null;
  const data = user
    ? await readerService.getReaderSession(user.id, c.req.param('workId'), preferredPartId)
    : await readerService.getPublicReaderSession(c.req.param('workId'), preferredPartId);
  return c.json(data);
});

readerRoutes.patch('/api/reader/works/:workId/state', requireAuth, validateUpdateReadingState, async (c) => {
  const user = c.get('user')!;
  const state = await readerService.updateReadingState(user.id, c.req.param('workId'), c.req.valid('json'));
  return c.json(state);
});

readerRoutes.get('/api/reader/parts/:partId/audio', async (c) => {
  const query = readerPartAudioQuerySchema.parse({ role: c.req.query('role') });
  const track = await readerService.getPublishedPartAudioTrack(c.req.param('partId'), query.role);
  return c.json(track);
});
