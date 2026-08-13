import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import { ASSIST_SSE_EVENT } from '@elynd/shared/api/assist';

import { AppError, NotFoundError } from '@/lib/errors';
import { type AuthVariables, requireAuth } from '@/middleware/auth';
import * as assistService from '@/modules/assist/service';
import { validateAssistAsk } from '@/modules/assist/validator';

export const assistRoutes = new Hono<{ Variables: AuthVariables }>();

assistRoutes.post('/api/assist/ask', requireAuth, validateAssistAsk, async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  c.header('X-Accel-Buffering', 'no');

  return streamSSE(c, async (stream) => {
    const abort = new AbortController();
    stream.onAbort(() => {
      abort.abort();
    });

    try {
      for await (const event of assistService.streamAssistAsk(user!.id, body, { signal: abort.signal })) {
        if (abort.signal.aborted) {
          return;
        }
        if (event.type === 'delta') {
          await stream.writeSSE({
            event: ASSIST_SSE_EVENT.delta,
            data: JSON.stringify({ text: event.text }),
          });
          continue;
        }
        await stream.writeSSE({
          event: ASSIST_SSE_EVENT.done,
          data: JSON.stringify({
            reply: event.content,
            model: { label: event.model.label },
          }),
        });
      }
    } catch (error) {
      if (abort.signal.aborted) {
        return;
      }
      const message =
        error instanceof NotFoundError ? error.message : error instanceof AppError ? error.message : 'AI unavailable';
      await stream.writeSSE({
        event: ASSIST_SSE_EVENT.error,
        data: JSON.stringify({ error: message }),
      });
    }
  });
});
