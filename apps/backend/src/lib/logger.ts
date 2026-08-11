import pino from 'pino';

import { env } from '@/lib/env';

export const rootLogger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname,module',
            messageFormat: '{module}: {msg}',
            singleLine: true,
          },
        }
      : undefined,
});

export const dbLogger = rootLogger.child({ module: 'Database' });
export const redisLogger = rootLogger.child({ module: 'Redis' });
export const authLogger = rootLogger.child({ module: 'Auth' });
export const serverLogger = rootLogger.child({ module: 'Server' });
