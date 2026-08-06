import { describe, expect, it } from 'vitest';

import { resolveRedisOptions } from './redis.options.js';

describe('resolveRedisOptions', () => {
  it('resolves host and default Compose-mapped port', () => {
    expect(resolveRedisOptions({ REDIS_HOST: '127.0.0.1' })).toEqual({
      host: '127.0.0.1',
      port: 6380,
    });
  });

  it('resolves an explicit port', () => {
    expect(resolveRedisOptions({ REDIS_HOST: 'redis', REDIS_PORT: '6379' })).toEqual({
      host: 'redis',
      port: 6379,
    });
  });

  it('fails when host is missing', () => {
    expect(() => resolveRedisOptions({})).toThrow(/REDIS_HOST/);
    expect(() => resolveRedisOptions({ REDIS_HOST: '  ' })).toThrow(/REDIS_HOST/);
  });

  it('fails when port is invalid', () => {
    expect(() => resolveRedisOptions({ REDIS_HOST: '127.0.0.1', REDIS_PORT: 'abc' })).toThrow(/REDIS_PORT/);
    expect(() => resolveRedisOptions({ REDIS_HOST: '127.0.0.1', REDIS_PORT: '0' })).toThrow(/REDIS_PORT/);
  });
});
