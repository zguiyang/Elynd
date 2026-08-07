import { AUTH_ROUTES } from '@/constants';

/** Adonis session cookie (`apps/backend/config/session.ts`). */
export const SESSION_COOKIE = 'adonis-session' as const;

export function expiredSessionCookieOptions() {
  return {
    httpOnly: true as const,
    path: '/' as const,
    maxAge: 0,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

const APP_PREFIXES = [AUTH_ROUTES.dashboard] as const;
const AUTH_ONLY = [AUTH_ROUTES.signIn, AUTH_ROUTES.signUp] as const;

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Soft UX redirect only — not a security check. */
export function resolveAuthPageRedirect(pathname: string, hasSessionCookie: boolean): string | null {
  const isApp = APP_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
  const isAuthOnly = (AUTH_ONLY as readonly string[]).includes(pathname);

  if (isApp && !hasSessionCookie) {
    return AUTH_ROUTES.signIn;
  }
  if (isAuthOnly && hasSessionCookie) {
    return AUTH_ROUTES.dashboard;
  }
  return null;
}
