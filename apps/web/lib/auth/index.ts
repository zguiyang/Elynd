export { authClient } from './client';
export { resolveMailCooldownErrorMessage } from './mail-cooldown';
export { resolveOptimisticAuthRedirect } from './session-gate';
export { AUTH_HINT_COOKIE, clearAccessToken, getAccessToken, hasAccessToken } from './token';
export type { AuthError, AuthUser, LoginResult } from './types';
