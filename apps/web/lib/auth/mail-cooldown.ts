import { isAuthRateLimited } from '@elynd/shared/api/auth-errors';
import { AUTH_MAIL_COOLDOWN_ERROR_CODE, mailCooldownUserMessage } from '@elynd/shared/auth/policy';

/**
 * Map rate-limit / legacy cooldown errors to UX copy.
 * Primary abuse control is BA built-in 429; Redis MAIL_SEND_COOLDOWN is legacy-only.
 */
export function resolveMailCooldownErrorMessage(error: {
  code?: string | number;
  message?: string | null;
  status?: number;
}): string | null {
  const code = typeof error.code === 'string' ? error.code : '';
  if (code === AUTH_MAIL_COOLDOWN_ERROR_CODE) {
    return error.message?.trim() || mailCooldownUserMessage('emailVerification');
  }
  if (isAuthRateLimited(error)) {
    return error.message?.trim() || '请求过于频繁，请稍后再试';
  }
  return null;
}
