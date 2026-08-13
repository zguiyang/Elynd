import { Hono } from 'hono';

import { type AuthVariables, requireAuth } from '@/middleware/auth';
import * as assistService from '@/modules/assist/service';
import { validateAssistAsk } from '@/modules/assist/validator';

export const assistRoutes = new Hono<{ Variables: AuthVariables }>();

assistRoutes.post('/api/assist/ask', requireAuth, validateAssistAsk, async (c) => {
  const user = c.get('user');
  const data = await assistService.askAssist(user!.id, c.req.valid('json'));
  return c.json(data);
});
