import { Hono } from 'hono';

import { HTTP_STATUS } from '@/constants';
import { type AuthVariables, requireAuth } from '@/middleware/auth';
import * as conversationsService from '@/modules/conversations/service';
import { validateConversationListQuery, validateCreateConversation } from '@/modules/conversations/validator';

export const conversationsRoutes = new Hono<{ Variables: AuthVariables }>();

conversationsRoutes.post('/api/conversations', requireAuth, validateCreateConversation, async (c) => {
  const user = c.get('user')!;
  const conversation = await conversationsService.createConversation(user.id, c.req.valid('json'));
  return c.json(conversation, HTTP_STATUS.CREATED);
});

conversationsRoutes.get('/api/conversations', requireAuth, validateConversationListQuery, async (c) => {
  const user = c.get('user')!;
  const data = await conversationsService.listConversations(user.id, c.req.valid('query'));
  return c.json(data);
});

conversationsRoutes.get('/api/conversations/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const data = await conversationsService.getConversation(user.id, c.req.param('id'));
  return c.json(data);
});
