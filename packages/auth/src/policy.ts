/**
 * Side-effect-free auth validation policy (password / username / mail cooldown).
 * Safe to import from apps/web — does not load Better Auth, env, or DB.
 */
export const AUTH_PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
} as const;

export const AUTH_USERNAME_POLICY = {
  minLength: 3,
  maxLength: 50,
  /** Letters, digits, dots, underscores — aligns with Better Auth username defaults. */
  pattern: /^[a-zA-Z0-9._]+$/,
} as const;

/**
 * Seconds to wait before re-sending the same auth mail purpose
 * (email verification or password reset). SSOT for Redis EX and UX copy.
 */
export const AUTH_MAIL_SEND_COOLDOWN_SECONDS = 30 * 60;

/** Stable error code when a resend is blocked by cooldown. */
export const AUTH_MAIL_COOLDOWN_ERROR_CODE = 'MAIL_SEND_COOLDOWN' as const;

export function mailCooldownUserMessage(cooldownSeconds: number = AUTH_MAIL_SEND_COOLDOWN_SECONDS): string {
  const minutes = Math.max(1, Math.round(cooldownSeconds / 60));
  return `请使用已发送的邮件，${minutes} 分钟内无需重复发送`;
}

export function isValidUsername(username: string): boolean {
  return AUTH_USERNAME_POLICY.pattern.test(username);
}
