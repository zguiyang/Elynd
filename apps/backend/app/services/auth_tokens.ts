import encryption from '@adonisjs/core/services/encryption';
import { Exception } from '@adonisjs/core/exceptions';
import { AUTH_TOKEN_EXPIRES_IN } from '#auth/policy';

export type EmailVerificationTokenPayload = {
  userId: number;
  email: string;
};

export type PasswordResetTokenPayload = {
  userId: number;
};

const PURPOSE_EMAIL_VERIFICATION = 'email-verification';
const PURPOSE_PASSWORD_RESET = 'password-reset';

export function createEmailVerificationToken(payload: EmailVerificationTokenPayload): string {
  return encryption.encrypt(payload, {
    expiresIn: AUTH_TOKEN_EXPIRES_IN,
    purpose: PURPOSE_EMAIL_VERIFICATION,
  });
}

export function decryptEmailVerificationToken(token: string): EmailVerificationTokenPayload {
  const payload = encryption.decrypt(token, PURPOSE_EMAIL_VERIFICATION);
  if (!isEmailVerificationPayload(payload)) {
    throw new Exception('Invalid or expired email verification token', {
      status: 400,
      code: 'E_INVALID_EMAIL_TOKEN',
    });
  }
  return payload;
}

export function createPasswordResetToken(payload: PasswordResetTokenPayload): string {
  return encryption.encrypt(payload, {
    expiresIn: AUTH_TOKEN_EXPIRES_IN,
    purpose: PURPOSE_PASSWORD_RESET,
  });
}

export function decryptPasswordResetToken(token: string): PasswordResetTokenPayload {
  const payload = encryption.decrypt(token, PURPOSE_PASSWORD_RESET);
  if (!isPasswordResetPayload(payload)) {
    throw new Exception('Invalid or expired password reset token', {
      status: 400,
      code: 'E_INVALID_PASSWORD_TOKEN',
    });
  }
  return payload;
}

function isEmailVerificationPayload(value: unknown): value is EmailVerificationTokenPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.userId === 'number' && typeof record.email === 'string';
}

function isPasswordResetPayload(value: unknown): value is PasswordResetTokenPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.userId === 'number';
}
