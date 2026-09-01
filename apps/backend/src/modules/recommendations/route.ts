import { Hono } from 'hono';

import { type AuthVariables, requireAuth } from '@/middleware/auth';
import * as recommendationsService from '@/modules/recommendations/service';
import { validateRecommendationsQuery } from '@/modules/recommendations/validator';

export const recommendationsRoutes = new Hono<{ Variables: AuthVariables }>();

recommendationsRoutes.get('/api/recommendations', requireAuth, validateRecommendationsQuery, async (c) => {
  const user = c.get('user')!;
  const query = c.req.valid('query');
  const data = await recommendationsService.getRecommendations(user.id, query);
  return c.json(data);
});
