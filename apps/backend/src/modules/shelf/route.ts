import { Hono } from 'hono';

import { type AuthVariables, requireAuth } from '@/middleware/auth';
import * as shelfService from '@/modules/shelf/service';

export const shelfRoutes = new Hono<{ Variables: AuthVariables }>();

shelfRoutes.get('/api/shelf', requireAuth, async (c) => {
  const user = c.get('user')!;
  const data = await shelfService.getShelf(user.id);
  return c.json(data);
});
