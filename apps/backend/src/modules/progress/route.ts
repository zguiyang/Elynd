import { Hono } from 'hono';

import { type AuthVariables, requireAuth } from '@/middleware/auth';
import * as progressService from '@/modules/progress/service';

export const progressRoutes = new Hono<{ Variables: AuthVariables }>();

progressRoutes.get('/api/progress', requireAuth, async (c) => {
  const user = c.get('user')!;
  const data = await progressService.getProgress(user.id);
  return c.json(data);
});
