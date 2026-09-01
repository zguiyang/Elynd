import { Hono } from 'hono';

import { readingHeartbeatBodySchema } from '@gloaming/shared/api/reading-history';

import { sendValidationError } from '@/lib/response';
import { type AuthVariables, requireAuth } from '@/middleware/auth';
import * as readingHistoryService from '@/modules/reading-history/service';

export const readingHistoryRoutes = new Hono<{ Variables: AuthVariables }>();

readingHistoryRoutes.get('/api/reading-history', requireAuth, async (c) => {
  const user = c.get('user')!;
  const data = await readingHistoryService.getReadingHistory(user.id);
  return c.json(data);
});

readingHistoryRoutes.post('/api/reading-heartbeat', requireAuth, async (c) => {
  const user = c.get('user')!;
  const parsed = readingHeartbeatBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return sendValidationError(
      c,
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  const result = await readingHistoryService.recordReadingHeartbeat(user.id, parsed.data.seconds);
  return c.json(result);
});
