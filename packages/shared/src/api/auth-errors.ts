/**
 * Stable auth error codes for web branching.
 * BA native codes differ from legacy Adonis; use helpers at call sites.
 */

/** Legacy Adonis code (still thrown by `apps/backend-adonis`). */
export const AUTH_ERROR_EMAIL_NOT_VERIFIED = 'E_EMAIL_NOT_VERIFIED' as const;

/** Better Auth email-not-verified code. */
export const BA_ERROR_EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED' as const;

export const AUTH_ERROR_USER_EXISTS = 'E_USER_EXISTS' as const;
export const AUTH_ERROR_INVALID_EMAIL_TOKEN = 'E_INVALID_EMAIL_TOKEN' as const;
export const AUTH_ERROR_INVALID_PASSWORD_TOKEN = 'E_INVALID_PASSWORD_TOKEN' as const;

export function isEmailNotVerifiedError(code?: string | number | null): boolean {
  return code === AUTH_ERROR_EMAIL_NOT_VERIFIED || code === BA_ERROR_EMAIL_NOT_VERIFIED;
}

/** BA built-in rate limit — HTTP 429 (no Redis MAIL_SEND_COOLDOWN this phase). */
export function isAuthRateLimited(error: { status?: number; code?: string | number } | null): boolean {
  if (!error) {
    return false;
  }
  return error.status === 429 || error.code === 'TOO_MANY_REQUESTS';
}
