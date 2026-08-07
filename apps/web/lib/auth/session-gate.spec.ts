import { describe, expect, it } from 'vitest';

import { AUTH_ROUTES } from '@/constants';
import { resolveAuthPageRedirect } from '@/lib/auth/session-gate';

describe('resolveAuthPageRedirect', () => {
  it('sends users without a cookie away from app routes', () => {
    expect(resolveAuthPageRedirect(AUTH_ROUTES.dashboard, false)).toBe(AUTH_ROUTES.signIn);
  });

  it('sends users with a cookie away from sign-in and sign-up', () => {
    expect(resolveAuthPageRedirect(AUTH_ROUTES.signIn, true)).toBe(AUTH_ROUTES.dashboard);
    expect(resolveAuthPageRedirect(AUTH_ROUTES.signUp, true)).toBe(AUTH_ROUTES.dashboard);
  });

  it('leaves forgot/reset and public paths alone', () => {
    expect(resolveAuthPageRedirect(AUTH_ROUTES.forgotPassword, true)).toBeNull();
    expect(resolveAuthPageRedirect(AUTH_ROUTES.resetPassword, false)).toBeNull();
    expect(resolveAuthPageRedirect('/', false)).toBeNull();
  });

  it('allows app routes when a session cookie is present', () => {
    expect(resolveAuthPageRedirect(AUTH_ROUTES.dashboard, true)).toBeNull();
  });
});
