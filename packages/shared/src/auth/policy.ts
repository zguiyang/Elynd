/**
 * Side-effect-free auth validation policy (password / username / mail cooldown).
 * SSOT for apps/web + apps/backend — safe to import from the browser bundle.
 */

export const AUTH_PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
} as const;

export const AUTH_USERNAME_POLICY = {
  minLength: 3,
  maxLength: 50,
  /** Letters, digits, dots, underscores. */
  pattern: /^[a-zA-Z0-9._]+$/,
} as const;

/** Independent Redis cooldown buckets for auth transactional mail. */
export type AuthMailCooldownPurpose = 'emailVerification' | 'passwordReset';

/**
 * Per-purpose resend cooldown (seconds). SSOT for Redis EX and UX copy.
 * Buckets are independent — verification cooldown must not block password reset.
 */
export const AUTH_MAIL_COOLDOWN_SECONDS_BY_PURPOSE = {
  emailVerification: 30 * 60,
  passwordReset: 10 * 60,
} as const satisfies Record<AuthMailCooldownPurpose, number>;

/** Stable error code when a resend is blocked by cooldown. */
export const AUTH_MAIL_COOLDOWN_ERROR_CODE = 'MAIL_SEND_COOLDOWN' as const;

export function mailCooldownSeconds(purpose: AuthMailCooldownPurpose): number {
  return AUTH_MAIL_COOLDOWN_SECONDS_BY_PURPOSE[purpose];
}

export function mailCooldownUserMessage(purpose: AuthMailCooldownPurpose = 'emailVerification'): string {
  const minutes = Math.max(1, Math.round(mailCooldownSeconds(purpose) / 60));
  if (purpose === 'passwordReset') {
    return `重置密码邮件已发送，请 ${minutes} 分钟后再试重发`;
  }
  return `验证邮件已发送，请 ${minutes} 分钟后再试重发`;
}

export function isValidUsername(username: string): boolean {
  return AUTH_USERNAME_POLICY.pattern.test(username);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
