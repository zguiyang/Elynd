import { Hono } from 'hono';

import { HTTP_STATUS } from '@/constants';
import { enqueueReviewMaterialize } from '@/lib/queue';
import { type AuthVariables, requireAdmin, requireAuth } from '@/middleware/auth';
import * as reviewService from '@/modules/review/service';
import {
  validateGenerateReviewItems,
  validateReplaceReviewItems,
  validateReviewAnswer,
} from '@/modules/review/validator';

export const reviewRoutes = new Hono<{ Variables: AuthVariables }>();

reviewRoutes.get('/api/review/today', requireAuth, async (c) => {
  const user = c.get('user')!;
  const data = await reviewService.getReviewToday(user.id);
  return c.json(data);
});

reviewRoutes.post('/api/review/today/answers', requireAuth, validateReviewAnswer, async (c) => {
  const user = c.get('user')!;
  const data = await reviewService.answerReviewToday(user.id, c.req.valid('json'));
  return c.json(data);
});

reviewRoutes.post('/api/review/today/leave', requireAuth, async (c) => {
  const user = c.get('user')!;
  const data = await reviewService.leaveReviewToday(user.id);
  return c.json(data);
});

reviewRoutes.post('/api/review/today/feedback', requireAuth, async (c) => {
  const user = c.get('user')!;
  const data = await reviewService.getReviewTodayFeedback(user.id);
  return c.json(data);
});

reviewRoutes.get('/api/admin/articles/:id/review-items', requireAdmin, async (c) => {
  const data = await reviewService.getAdminReviewItems(c.req.param('id'));
  return c.json(data);
});

reviewRoutes.put('/api/admin/articles/:id/review-items', requireAdmin, validateReplaceReviewItems, async (c) => {
  const data = await reviewService.replaceAdminReviewItems(c.req.param('id'), c.req.valid('json'));
  return c.json(data);
});

reviewRoutes.post(
  '/api/admin/articles/:id/review-items/generate',
  requireAdmin,
  validateGenerateReviewItems,
  async (c) => {
    const user = c.get('user')!;
    const data = await reviewService.generateAdminReviewItems(c.req.param('id'), user.id);
    return c.json(data);
  },
);

reviewRoutes.post('/api/admin/review/materialize', requireAdmin, async (c) => {
  const id = await enqueueReviewMaterialize({ mode: 'manual' });
  return c.json({ id }, HTTP_STATUS.ACCEPTED);
});
