import { Hono } from 'hono';

import { type AuthVariables, requireAuth } from '@/middleware/auth';
import * as readingHistoryService from '@/modules/reading-history/service';

export const readingHistoryRoutes = new Hono<{ Variables: AuthVariables }>();

readingHistoryRoutes.get('/api/reading-history', requireAuth, async (c) => {
  const user = c.get('user')!;
  const data = await readingHistoryService.getReadingHistory(user.id);
  return c.json(data);
});
