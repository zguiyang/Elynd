import { AUTH_MAIL_COOLDOWN_ERROR_CODE, mailCooldownUserMessage } from '@elynd/shared/auth/policy';

export function resolveMailCooldownErrorMessage(error: {
  code?: string | number;
  message?: string | null;
  status?: number;
}): string | null {
  const code = typeof error.code === 'string' ? error.code : '';
  if (code === AUTH_MAIL_COOLDOWN_ERROR_CODE) {
    return error.message?.trim() || mailCooldownUserMessage('emailVerification');
  }
  return null;
}
