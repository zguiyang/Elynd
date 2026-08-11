import { describe, expect, it } from 'vitest';

import { loginBodySchema, registerBodySchema, userSchema } from './auth.ts';
import { BA_ERROR_EMAIL_NOT_VERIFIED, isEmailNotVerifiedError } from './auth-errors.ts';

describe('loginBodySchema', () => {
  it('accepts login + password', () => {
    expect(loginBodySchema.parse({ login: 'ada', password: 'password1' })).toEqual({
      login: 'ada',
      password: 'password1',
    });
  });
});

describe('registerBodySchema', () => {
  it('accepts register wire body with BA name field', () => {
    expect(
      registerBodySchema.parse({
        email: 'ada@example.com',
        username: 'ada.reader',
        password: 'password1',
        name: 'Ada',
      }),
    ).toMatchObject({ email: 'ada@example.com', username: 'ada.reader', name: 'Ada' });
  });
});

describe('userSchema', () => {
  it('parses User with string id and name', () => {
    const user = {
      id: 'user_1',
      email: 'a@b.com',
      username: 'a',
      name: 'Ada',
      role: 'user',
      image: null,
      emailVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(userSchema.parse(user)).toEqual(user);
  });
});

describe('auth-errors', () => {
  it('detects Better Auth email-not-verified code', () => {
    expect(isEmailNotVerifiedError(BA_ERROR_EMAIL_NOT_VERIFIED)).toBe(true);
    expect(isEmailNotVerifiedError('OTHER')).toBe(false);
  });
});
