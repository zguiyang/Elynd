import { AUTH_ROUTES } from '@/constants';

const APP_ROUTE_PREFIXES = [AUTH_ROUTES.dashboard] as const;

const AUTH_ONLY_ROUTES = [AUTH_ROUTES.signIn, AUTH_ROUTES.signUp] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Optimistic auth redirect from cookie presence only.
 * Returns a path to redirect to, or null to continue.
 */
export function resolveOptimisticAuthRedirect(pathname: string, hasSessionCookie: boolean): string | null {
  const isAppRoute = APP_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
  const isAuthOnlyRoute = (AUTH_ONLY_ROUTES as readonly string[]).includes(pathname);

  if (isAppRoute && !hasSessionCookie) {
    return AUTH_ROUTES.signIn;
  }

  if (isAuthOnlyRoute && hasSessionCookie) {
    return AUTH_ROUTES.dashboard;
  }

  return null;
}
