import 'dotenv/config';

import { serve } from '@hono/node-server';

import app from '@/app';
import { DEFAULT_PORT } from '@/constants';
import { env } from '@/lib/env';
import { serverLogger } from '@/lib/logger';

const port = env.PORT || DEFAULT_PORT;

serverLogger.info(`Listening on http://${env.HOST}:${port}`);

serve({
  fetch: app.fetch,
  port,
  // Prefer dual-stack; binding `localhost` can be IPv6-only on macOS.
  hostname: env.HOST === 'localhost' ? '0.0.0.0' : env.HOST,
});
