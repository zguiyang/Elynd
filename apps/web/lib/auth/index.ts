export type { AuthError, AuthUser, User } from './client';
export { authClient } from './client';
export { resolveMailCooldownErrorMessage } from './mail-cooldown';
export { resolveAuthPageRedirect, SESSION_COOKIE } from './session-gate';
