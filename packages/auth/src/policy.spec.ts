import { describe, expect, it } from 'vitest';

import {
  AUTH_MAIL_SEND_COOLDOWN_SECONDS,
  AUTH_PASSWORD_POLICY,
  AUTH_USERNAME_POLICY,
  isValidUsername,
  mailCooldownUserMessage,
} from './policy.js';

describe('AUTH_PASSWORD_POLICY', () => {
  it('matches Better Auth email/password length bounds', () => {
    expect(AUTH_PASSWORD_POLICY.minLength).toBe(8);
    expect(AUTH_PASSWORD_POLICY.maxLength).toBe(128);
    expect(AUTH_PASSWORD_POLICY.minLength).toBeLessThan(AUTH_PASSWORD_POLICY.maxLength);
  });
});

describe('AUTH_MAIL_SEND_COOLDOWN_SECONDS', () => {
  it('is a positive 30-minute window', () => {
    expect(AUTH_MAIL_SEND_COOLDOWN_SECONDS).toBe(30 * 60);
  });
});

describe('mailCooldownUserMessage', () => {
  it('includes minutes derived from the SSOT constant', () => {
    expect(mailCooldownUserMessage()).toContain('30');
    expect(mailCooldownUserMessage(90)).toContain('2');
  });
});

describe('AUTH_USERNAME_POLICY', () => {
  it('matches username plugin length bounds used by the app', () => {
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
