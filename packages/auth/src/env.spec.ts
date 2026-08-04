import { describe, expect, it } from 'vitest';

import { authEnvSchema, parseTrustedOrigins } from './env.js';

describe('parseTrustedOrigins', () => {
  it('splits and trims comma-separated origins', () => {
    expect(parseTrustedOrigins(' http://localhost:3000 , https://app.example.com ')).toEqual([
      'http://localhost:3000',
      'https://app.example.com',
    ]);
  });

  it('drops empty segments', () => {
    expect(parseTrustedOrigins('http://localhost:3000,,')).toEqual(['http://localhost:3000']);
  });
});

describe('authEnvSchema', () => {
  it('accepts required auth env keys', () => {
    const parsed = authEnvSchema.parse({
      BETTER_AUTH_URL: 'http://localhost:3000',
      BETTER_AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
      AUTH_SECRET: 'dev-auth-secret-change-me-32chars-min',
      DATABASE_URI: 'postgresql://root:root@127.0.0.1:5433/app',
    });

    expect(parsed.BETTER_AUTH_URL).toBe('http://localhost:3000');
  });

  it('rejects missing AUTH_SECRET', () => {
    expect(() =>
      authEnvSchema.parse({
        BETTER_AUTH_URL: 'http://localhost:3000',
        BETTER_AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
        DATABASE_URI: 'postgresql://root:root@127.0.0.1:5433/app',
      }),
    ).toThrow();
  });
});
