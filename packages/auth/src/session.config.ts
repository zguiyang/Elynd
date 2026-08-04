/**
 * Short session lifetime — better-auth `session.expiresIn` (seconds).
 */
export const AUTH_SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

/**
 * Long renewal window — better-auth `session.updateAge` (seconds).
 * Active sessions are extended when used after this age.
 */
export const AUTH_SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

export const AUTH_SESSION_CONFIG = {
  expiresIn: AUTH_SESSION_EXPIRES_IN_SECONDS,
  updateAge: AUTH_SESSION_UPDATE_AGE_SECONDS,
} as const;
