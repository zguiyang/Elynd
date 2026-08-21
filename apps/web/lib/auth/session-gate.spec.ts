import { describe, expect, it } from 'vitest';

import { ADMIN_ROUTES, AUTH_ROUTES } from '@/constants';
import {
  hasSessionCookie,
  resolveAuthPageRedirect,
  SESSION_COOKIE,
  SESSION_COOKIE_SECURE,
} from '@/lib/auth/session-gate';

describe('hasSessionCookie', () => {
  it('accepts default or __Secure- Better Auth session cookie names', () => {
    expect(hasSessionCookie((name) => (name === SESSION_COOKIE ? 'token' : undefined))).toBe(true);
    expect(hasSessionCookie((name) => (name === SESSION_COOKIE_SECURE ? 'token' : undefined))).toBe(true);
    expect(hasSessionCookie(() => undefined)).toBe(false);
  });
});

describe('resolveAuthPageRedirect', () => {
  it('sends users without a cookie away from app routes', () => {
    expect(resolveAuthPageRedirect(AUTH_ROUTES.shelf, false)).toBe(AUTH_ROUTES.signIn);
    expect(resolveAuthPageRedirect('/dashboard', false)).toBe(AUTH_ROUTES.signIn);
    expect(resolveAuthPageRedirect(AUTH_ROUTES.library, false)).toBe(AUTH_ROUTES.signIn);
    expect(resolveAuthPageRedirect(`${AUTH_ROUTES.library}/abc`, false)).toBe(AUTH_ROUTES.signIn);
    expect(resolveAuthPageRedirect(AUTH_ROUTES.progress, false)).toBe(AUTH_ROUTES.signIn);
    expect(resolveAuthPageRedirect(`${AUTH_ROUTES.progress}/abc`, false)).toBe(AUTH_ROUTES.signIn);
    expect(resolveAuthPageRedirect(AUTH_ROUTES.learn, false)).toBe(AUTH_ROUTES.signIn);
    expect(resolveAuthPageRedirect(`${AUTH_ROUTES.learn}/abc`, false)).toBe(AUTH_ROUTES.signIn);
    expect(resolveAuthPageRedirect(ADMIN_ROUTES.root, false)).toBe(AUTH_ROUTES.signIn);
    expect(resolveAuthPageRedirect(ADMIN_ROUTES.articles, false)).toBe(AUTH_ROUTES.signIn);
  });

  it('sends users with a cookie away from sign-in and sign-up', () => {
    expect(resolveAuthPageRedirect(AUTH_ROUTES.signIn, true)).toBe(AUTH_ROUTES.shelf);
    expect(resolveAuthPageRedirect(AUTH_ROUTES.signUp, true)).toBe(AUTH_ROUTES.shelf);
  });

  it('leaves forgot/reset and public paths alone', () => {
    expect(resolveAuthPageRedirect(AUTH_ROUTES.forgotPassword, true)).toBeNull();
    expect(resolveAuthPageRedirect(AUTH_ROUTES.resetPassword, false)).toBeNull();
    expect(resolveAuthPageRedirect('/', false)).toBeNull();
  });

  it('allows app routes when a session cookie is present', () => {
    expect(resolveAuthPageRedirect(AUTH_ROUTES.shelf, true)).toBeNull();
    expect(resolveAuthPageRedirect('/dashboard', true)).toBeNull();
    expect(resolveAuthPageRedirect(AUTH_ROUTES.library, true)).toBeNull();
    expect(resolveAuthPageRedirect(`${AUTH_ROUTES.library}/abc`, true)).toBeNull();
    expect(resolveAuthPageRedirect(AUTH_ROUTES.progress, true)).toBeNull();
    expect(resolveAuthPageRedirect(AUTH_ROUTES.learn, true)).toBeNull();
    expect(resolveAuthPageRedirect(`${AUTH_ROUTES.learn}/abc`, true)).toBeNull();
    expect(resolveAuthPageRedirect(ADMIN_ROUTES.root, true)).toBeNull();
    expect(resolveAuthPageRedirect(ADMIN_ROUTES.articles, true)).toBeNull();
  });
});
