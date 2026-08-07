/**
 * Auth validation policy (password / username / mail cooldown).
 * Local SSOT for apps/backend — values mirror legacy Nest/@elynd/auth policy.
 */

export const AUTH_PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
} as const

export const AUTH_USERNAME_POLICY = {
  minLength: 3,
  maxLength: 50,
  pattern: /^[a-zA-Z0-9._]+$/,
} as const

export type AuthMailCooldownPurpose = 'emailVerification' | 'passwordReset'

export const AUTH_MAIL_COOLDOWN_SECONDS_BY_PURPOSE = {
  emailVerification: 30 * 60,
  passwordReset: 10 * 60,
} as const satisfies Record<AuthMailCooldownPurpose, number>

export const AUTH_MAIL_COOLDOWN_ERROR_CODE = 'MAIL_SEND_COOLDOWN' as const

export const AUTH_TOKEN_EXPIRES_IN = '1 hour' as const

export function mailCooldownSeconds(purpose: AuthMailCooldownPurpose): number {
  return AUTH_MAIL_COOLDOWN_SECONDS_BY_PURPOSE[purpose]
}

export function mailCooldownUserMessage(
  purpose: AuthMailCooldownPurpose = 'emailVerification'
): string {
  const minutes = Math.max(1, Math.round(mailCooldownSeconds(purpose) / 60))
  if (purpose === 'passwordReset') {
    return `重置密码邮件已发送，请 ${minutes} 分钟后再试重发`
  }
  return `验证邮件已发送，请 ${minutes} 分钟后再试重发`
}

export function isValidUsername(username: string): boolean {
  return AUTH_USERNAME_POLICY.pattern.test(username)
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
