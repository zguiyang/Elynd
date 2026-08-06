import { describe, expect, it } from 'vitest';

import {
  AUTH_COOKIE_PREFIX,
  AUTH_SESSION_CONFIG,
  AUTH_SESSION_EXPIRES_IN_SECONDS,
  AUTH_SESSION_UPDATE_AGE_SECONDS,
} from './session.config.js';

describe('AUTH_COOKIE_PREFIX', () => {
  it('matches Better Auth cookiePrefix used by Nest and web middleware', () => {
    expect(AUTH_COOKIE_PREFIX).toBe('elynd-auth');
  });
});

describe('AUTH-SESSION-004 short session lifetime', () => {
  it('expiresIn is 7 days in seconds', () => {
    expect(AUTH_SESSION_EXPIRES_IN_SECONDS).toBe(60 * 60 * 24 * 7);
    expect(AUTH_SESSION_CONFIG.expiresIn).toBe(AUTH_SESSION_EXPIRES_IN_SECONDS);
  });
});

describe('AUTH-SESSION-005 long renewal window', () => {
  it('updateAge is 1 day and shorter than expiresIn', () => {
    expect(AUTH_SESSION_UPDATE_AGE_SECONDS).toBe(60 * 60 * 24);
    expect(AUTH_SESSION_CONFIG.updateAge).toBe(AUTH_SESSION_UPDATE_AGE_SECONDS);
    expect(AUTH_SESSION_UPDATE_AGE_SECONDS).toBeLessThan(AUTH_SESSION_EXPIRES_IN_SECONDS);
  });
});
