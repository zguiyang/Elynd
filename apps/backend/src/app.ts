import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { errorHandler } from '@/middleware/error';
import { logger } from '@/middleware/logger';
import { apiLimiter } from '@/middleware/rate-limiter';
import { routes } from '@/routes';

const app = new Hono();

app.use('*', requestId());
app.use('*', logger);
app.use(
  '*',
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);
app.use('*', secureHeaders());

app.use('*', async (c, next) => {
  if (c.req.path === '/' || c.req.path === '/api/health') {
    return next();
  }
  return apiLimiter(c, next);
});

app.onError(errorHandler);

app.get('/', (c) => c.json({ ok: true }));

app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

app.route('/', routes);

export default app;
export type AppType = typeof app;
