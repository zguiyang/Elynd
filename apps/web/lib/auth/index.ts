export type { AuthError, User } from './client';
export { authClient } from './client';
export { resolveMailCooldownErrorMessage } from './mail-cooldown';
export { hasSessionCookie, resolveAuthPageRedirect, SESSION_COOKIE, SESSION_COOKIE_SECURE } from './session-gate';
