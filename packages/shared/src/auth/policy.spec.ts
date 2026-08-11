import { describe, expect, it } from 'vitest';

import { AUTH_PASSWORD_POLICY, AUTH_USERNAME_POLICY, isValidUsername, normalizeEmail } from './policy';

describe('AUTH_PASSWORD_POLICY', () => {
  it('keeps password length bounds', () => {
    expect(AUTH_PASSWORD_POLICY.minLength).toBe(8);
    expect(AUTH_PASSWORD_POLICY.maxLength).toBe(128);
    expect(AUTH_PASSWORD_POLICY.minLength).toBeLessThan(AUTH_PASSWORD_POLICY.maxLength);
  });
});

describe('AUTH_USERNAME_POLICY', () => {
  it('matches username length bounds used by the app', () => {
    expect(AUTH_USERNAME_POLICY.minLength).toBe(3);
    expect(AUTH_USERNAME_POLICY.maxLength).toBe(50);
  });

  it('accepts alphanumeric usernames with dots and underscores', () => {
    expect(isValidUsername('ada.reader')).toBe(true);
    expect(isValidUsername('ada_reader')).toBe(true);
    expect(isValidUsername('Ada123')).toBe(true);
  });

  it('rejects usernames outside the allowed pattern', () => {
    expect(isValidUsername('ada reader')).toBe(false);
    expect(isValidUsername('ada!')).toBe(false);
    expect(isValidUsername('ada-reader')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });
});
