import { describe, expect, it } from 'vitest';

import { signInSchema, signUpSchema } from './auth';

describe('signInSchema', () => {
  it('accepts a valid email and password', () => {
    const parsed = signInSchema.parse({
      email: 'reader@example.com',
      password: 'password1',
    });

    expect(parsed).toEqual({
      email: 'reader@example.com',
      password: 'password1',
    });
  });

  it('rejects an invalid email', () => {
    const result = signInSchema.safeParse({
      email: 'not-an-email',
      password: 'password1',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = signInSchema.safeParse({
      email: 'reader@example.com',
      password: 'short',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a password longer than 128 characters', () => {
    const result = signInSchema.safeParse({
      email: 'reader@example.com',
      password: 'p'.repeat(129),
    });

    expect(result.success).toBe(false);
  });
});

describe('signUpSchema', () => {
  const valid = {
    name: 'Ada Reader',
    username: 'ada.reader',
    email: 'ada@example.com',
    password: 'password1',
  };

  it('accepts a valid sign-up payload', () => {
    expect(signUpSchema.parse(valid)).toEqual(valid);
  });

  it('rejects an empty name', () => {
    const result = signUpSchema.safeParse({ ...valid, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a username shorter than 3 characters', () => {
    const result = signUpSchema.safeParse({ ...valid, username: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects a username with invalid characters', () => {
    const result = signUpSchema.safeParse({ ...valid, username: 'ada reader!' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = signUpSchema.safeParse({ ...valid, email: 'ada@' });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = signUpSchema.safeParse({ ...valid, password: '1234567' });
    expect(result.success).toBe(false);
  });

  it('rejects a password longer than 128 characters', () => {
    const result = signUpSchema.safeParse({ ...valid, password: 'p'.repeat(129) });
    expect(result.success).toBe(false);
  });
});
