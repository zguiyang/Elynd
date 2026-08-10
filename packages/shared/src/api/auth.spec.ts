import { describe, expect, it } from 'vitest';

import { loginBodySchema, registerBodySchema, userSchema } from './auth.ts';
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
  it('accepts register wire body', () => {
    expect(
      registerBodySchema.parse({
        email: 'ada@example.com',
        username: 'ada.reader',
        password: 'password1',
      }),
    ).toMatchObject({ email: 'ada@example.com', username: 'ada.reader' });
  });
});

describe('userSchema + envelope', () => {
  it('parses ApiData<User>', () => {
    const user = {
      id: 1,
      email: 'a@b.com',
      username: 'a',
      fullName: null,
      role: 'user',
      image: null,
      emailVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
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
