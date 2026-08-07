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
  if (error.message?.includes('分钟后再试重发') || error.message?.includes('分钟内无需重复发送')) {
    return error.message;
  }
  return null;
}
