export type RedisConnectionOptions = {
  host: string;
  port: number;
};

const DEFAULT_REDIS_PORT = 6380;

/**
 * Resolve Redis connection options from env-like config.
 * Fail-fast when host is missing — Redis is a required API dependency once integrated.
 */
export function resolveRedisOptions(env: { REDIS_HOST?: string; REDIS_PORT?: string }): RedisConnectionOptions {
  const host = env.REDIS_HOST?.trim();
  if (!host) {
    throw new Error('REDIS_HOST is required to initialize Redis');
  }

  const portRaw = env.REDIS_PORT?.trim();
  const port = portRaw ? Number(portRaw) : DEFAULT_REDIS_PORT;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`REDIS_PORT must be a valid TCP port, got: ${portRaw ?? ''}`);
  }

  return { host, port };
}
