/**
 * Auth validation policy for Adonis backend.
 * Cross-app SSOT lives in `@elynd/shared`; this module re-exports it and adds
 * backend-only token lifetime for encrypted verify/reset tokens.
 */

export {
  AUTH_MAIL_COOLDOWN_ERROR_CODE,
  AUTH_MAIL_COOLDOWN_SECONDS_BY_PURPOSE,
  AUTH_PASSWORD_POLICY,
  AUTH_USERNAME_POLICY,
  type AuthMailCooldownPurpose,
  isValidUsername,
  mailCooldownSeconds,
  mailCooldownUserMessage,
  normalizeEmail,
} from '@elynd/shared/auth/policy';

/** Encrypted email-verify / password-reset token lifetime (Adonis encryption). */
export const AUTH_TOKEN_EXPIRES_IN = '1 hour' as const;
