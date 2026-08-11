/**
 * Stable auth error codes for web branching (Better Auth wire codes).
 */

/** Better Auth email-not-verified code. */
export const BA_ERROR_EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED' as const;

export function isEmailNotVerifiedError(code?: string | number | null): boolean {
  return code === BA_ERROR_EMAIL_NOT_VERIFIED;
}

/** BA built-in rate limit — HTTP 429. */
export function isAuthRateLimited(error: { status?: number; code?: string | number } | null): boolean {
  if (!error) {
    return false;
  }
  return error.status === 429 || error.code === 'TOO_MANY_REQUESTS';
}
