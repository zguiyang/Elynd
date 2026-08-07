import { test } from '@japa/runner';
import {
  isValidUsername,
  mailCooldownSeconds,
  mailCooldownUserMessage,
  normalizeEmail,
  AUTH_MAIL_COOLDOWN_SECONDS_BY_PURPOSE,
} from '#auth/policy';
import { mailCooldownKey } from '#services/mail_cooldown_service';
import { applyUserCreateDefaults, resolveSignupRole } from '#auth/user_create_defaults';

test.group('Auth policy', () => {
  test('normalizes email', ({ assert }) => {
    assert.equal(normalizeEmail('  Foo@Example.COM '), 'foo@example.com');
  });

  test('validates username pattern', ({ assert }) => {
    assert.isTrue(isValidUsername('joy.zhao_1'));
    assert.isFalse(isValidUsername('bad name'));
    assert.isFalse(isValidUsername('bad@name'));
  });

  test('cooldown seconds are independent by purpose', ({ assert }) => {
    assert.equal(mailCooldownSeconds('emailVerification'), 30 * 60);
    assert.equal(mailCooldownSeconds('passwordReset'), 10 * 60);
    assert.notEqual(
      AUTH_MAIL_COOLDOWN_SECONDS_BY_PURPOSE.emailVerification,
      AUTH_MAIL_COOLDOWN_SECONDS_BY_PURPOSE.passwordReset,
    );
  });

  test('cooldown messages are chinese and purpose-specific', ({ assert }) => {
    assert.match(mailCooldownUserMessage('emailVerification'), /验证邮件/);
    assert.match(mailCooldownUserMessage('passwordReset'), /重置密码/);
  });

  test('builds normalized cooldown keys', ({ assert }) => {
    assert.equal(
      mailCooldownKey('emailVerification', '  Foo@Example.COM '),
      'mail:cooldown:emailVerification:foo@example.com',
    );
  });
});

test.group('User create defaults', () => {
  test('first user is admin', ({ assert }) => {
    assert.equal(resolveSignupRole(0), 'admin');
    assert.equal(resolveSignupRole(1), 'user');
  });

  test('forces role and dicebear image', ({ assert }) => {
    const defaults = applyUserCreateDefaults(0, { style: 'lorelei', seed: 'test-seed' });
    assert.equal(defaults.role, 'admin');
    assert.match(defaults.image, /^https:\/\/api\.dicebear\.com\/9\.x\/lorelei\/svg\?seed=test-seed$/);
  });
});
