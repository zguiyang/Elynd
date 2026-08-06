import { describe, expect, it } from 'vitest';

import { AUTH_ROUTES } from '@/constants';
import { resolveOptimisticAuthRedirect } from '@/lib/auth/session-gate';

describe('resolveOptimisticAuthRedirect', () => {
  it('sends unauthenticated users away from app routes', () => {
    expect(resolveOptimisticAuthRedirect(AUTH_ROUTES.dashboard, false)).toBe(AUTH_ROUTES.signIn);
  });

  it('sends authenticated users away from sign-in and sign-up', () => {
    expect(resolveOptimisticAuthRedirect(AUTH_ROUTES.signIn, true)).toBe(AUTH_ROUTES.dashboard);
    expect(resolveOptimisticAuthRedirect(AUTH_ROUTES.signUp, true)).toBe(AUTH_ROUTES.dashboard);
  });

  it('does not redirect forgot/reset password or public paths on cookie alone', () => {
    expect(resolveOptimisticAuthRedirect(AUTH_ROUTES.forgotPassword, true)).toBeNull();
    expect(resolveOptimisticAuthRedirect(AUTH_ROUTES.forgotPassword, false)).toBeNull();
    expect(resolveOptimisticAuthRedirect(AUTH_ROUTES.resetPassword, true)).toBeNull();
    expect(resolveOptimisticAuthRedirect(AUTH_ROUTES.resetPassword, false)).toBeNull();
    expect(resolveOptimisticAuthRedirect('/', false)).toBeNull();
  });

  it('allows app routes when a session cookie is present', () => {
    expect(resolveOptimisticAuthRedirect(AUTH_ROUTES.dashboard, true)).toBeNull();
  });
});
