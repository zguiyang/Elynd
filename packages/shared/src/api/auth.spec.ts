import { describe, expect, it } from 'vitest';

import { loginBodySchema, registerBodySchema, userSchema } from './auth.ts';
import { AUTH_ERROR_EMAIL_NOT_VERIFIED, BA_ERROR_EMAIL_NOT_VERIFIED, isEmailNotVerifiedError } from './auth-errors.ts';
import { apiDataSchema, apiValidationErrorSchema, paginationMetaSchema } from './envelope.ts';

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

describe('userSchema + envelope', () => {
  it('parses ApiData<User> with string id and name', () => {
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
    expect(apiDataSchema(userSchema).parse({ data: user })).toEqual({ data: user });
  });

  it('parses pagination meta and validation errors', () => {
    expect(
      paginationMetaSchema.parse({
        total: 10,
        perPage: 2,
        currentPage: 1,
        lastPage: 5,
        firstPage: 1,
        firstPageUrl: '/?page=1',
        lastPageUrl: '/?page=5',
        nextPageUrl: '/?page=2',
        previousPageUrl: null,
      }),
    ).toMatchObject({ total: 10, nextPageUrl: '/?page=2' });

    expect(
      apiValidationErrorSchema.parse({
        errors: [{ field: 'email', message: 'required', rule: 'required' }],
      }),
    ).toMatchObject({ errors: [{ field: 'email' }] });
  });
});

describe('auth-errors', () => {
  it('detects BA and legacy email-not-verified codes', () => {
    expect(isEmailNotVerifiedError(AUTH_ERROR_EMAIL_NOT_VERIFIED)).toBe(true);
    expect(isEmailNotVerifiedError(BA_ERROR_EMAIL_NOT_VERIFIED)).toBe(true);
    expect(isEmailNotVerifiedError('OTHER')).toBe(false);
  });
});
