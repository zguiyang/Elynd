import { getSessionCookie } from 'better-auth/cookies';

import { AUTH_COOKIE_PREFIX } from './session.config.js';

export { AUTH_COOKIE_PREFIX } from './session.config.js';

/**
 * Optimistic session-cookie presence check for Next middleware.
 * Does not validate the session — Nest AuthGuard / getSession remain authoritative.
 */
export function getElyndSessionCookie(request: Request | Headers): string | null {
  return getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX });
}
