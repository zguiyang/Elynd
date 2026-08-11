import { isAuthRateLimited } from '@elynd/shared/api/auth-errors';

/**
 * Map Better Auth rate-limit errors to UX copy.
 */
export function resolveMailCooldownErrorMessage(error: {
  code?: string | number;
  message?: string | null;
  status?: number;
}): string | null {
  if (isAuthRateLimited(error)) {
    return error.message?.trim() || '请求过于频繁，请稍后再试';
  }
  return null;
}
