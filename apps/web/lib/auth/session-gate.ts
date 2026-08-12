import { ADMIN_ROUTES, AUTH_ROUTES } from '@/constants';

/** Better Auth session cookie (default prefix + name). */
export const SESSION_COOKIE = 'better-auth.session_token' as const;

/** Secure-prefix variant used when BA marks cookies Secure. */
export const SESSION_COOKIE_SECURE = `__Secure-${SESSION_COOKIE}` as const;

export function expiredSessionCookieOptions() {
  return {
    httpOnly: true as const,
    path: '/' as const,
    maxAge: 0,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

export function hasSessionCookie(getCookie: (name: string) => string | undefined): boolean {
  return Boolean(getCookie(SESSION_COOKIE) || getCookie(SESSION_COOKIE_SECURE));
}

const APP_PREFIXES = [AUTH_ROUTES.dashboard, AUTH_ROUTES.library, AUTH_ROUTES.learn, ADMIN_ROUTES.root] as const;
const AUTH_ONLY = [AUTH_ROUTES.signIn, AUTH_ROUTES.signUp] as const;

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Soft UX redirect only — not a security check. */
export function resolveAuthPageRedirect(pathname: string, hasSession: boolean): string | null {
  const isApp = APP_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
  const isAuthOnly = (AUTH_ONLY as readonly string[]).includes(pathname);

  if (isApp && !hasSession) {
    return AUTH_ROUTES.signIn;
  }
  if (isAuthOnly && hasSession) {
    return AUTH_ROUTES.dashboard;
  }
  return null;
}
