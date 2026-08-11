import { pinoLogger } from 'hono-pino';

import { rootLogger } from '@/lib/logger';

export const logger = pinoLogger({
  pino: rootLogger,
  http: {
    onReqMessage: (c) => `→ ${c.req.method} ${c.req.path}`,
    onResMessage: (c) => `← ${c.req.method} ${c.req.path} ${c.res.status}`,
    onResLevel: (c) => {
      if (c.res.status >= 500) return 'error';
      if (c.res.status >= 400) return 'warn';
      return 'info';
    },
  },
});
