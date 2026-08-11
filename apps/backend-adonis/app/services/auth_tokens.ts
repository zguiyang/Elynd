/**
 * Opaque mail tokens stored in Redis (one-time, TTL-bound).
 * Not Adonis access-token guard tokens — application convention for verify/reset links.
 */

import { randomBytes } from 'node:crypto';

import { Exception } from '@adonisjs/core/exceptions';
import redis from '@adonisjs/redis/services/main';

import { AUTH_ERROR_INVALID_EMAIL_TOKEN, AUTH_ERROR_INVALID_PASSWORD_TOKEN } from '@elynd/shared/api/auth-errors';

import { AUTH_TOKEN_EXPIRES_IN_SECONDS } from '#auth/policy';

export type AuthMailTokenPurpose = 'email-verification' | 'password-reset';

export type EmailVerificationTokenPayload = {
  userId: number;
  email: string;
};

export type PasswordResetTokenPayload = {
  userId: number;
};

function tokenKey(purpose: AuthMailTokenPurpose, tokenId: string): string {
  return `auth:token:${purpose}:${tokenId}`;
}

function newTokenId(): string {
  return randomBytes(32).toString('base64url');
}

async function issueToken(purpose: AuthMailTokenPurpose, payload: object): Promise<string> {
  const tokenId = newTokenId();
  await redis.set(tokenKey(purpose, tokenId), JSON.stringify(payload), 'EX', AUTH_TOKEN_EXPIRES_IN_SECONDS);
  return tokenId;
}

async function consumeToken(purpose: AuthMailTokenPurpose, tokenId: string): Promise<unknown> {
  const key = tokenKey(purpose, tokenId);
  const raw = await redis.getdel(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
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

export async function issueEmailVerificationToken(payload: EmailVerificationTokenPayload): Promise<string> {
  return issueToken('email-verification', payload);
}

export async function consumeEmailVerificationToken(tokenId: string): Promise<EmailVerificationTokenPayload> {
  const payload = await consumeToken('email-verification', tokenId);
  if (!isEmailVerificationPayload(payload)) {
    throw new Exception('Invalid or expired email verification token', {
      status: 400,
      code: AUTH_ERROR_INVALID_EMAIL_TOKEN,
    });
  }
  return payload;
}

export async function issuePasswordResetToken(payload: PasswordResetTokenPayload): Promise<string> {
  return issueToken('password-reset', payload);
}

export async function consumePasswordResetToken(tokenId: string): Promise<PasswordResetTokenPayload> {
  const payload = await consumeToken('password-reset', tokenId);
  if (!isPasswordResetPayload(payload)) {
    throw new Exception('Invalid or expired password reset token', {
      status: 400,
      code: AUTH_ERROR_INVALID_PASSWORD_TOKEN,
    });
  }
  return payload;
}

/** Test / ops helper: prefix used by mail tokens (cleanup). */
export const AUTH_MAIL_TOKEN_KEY_PREFIX = 'auth:token:' as const;
