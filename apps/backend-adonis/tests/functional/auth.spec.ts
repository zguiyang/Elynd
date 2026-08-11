import { randomUUID } from 'node:crypto';

import { configProvider } from '@adonisjs/core';
import app from '@adonisjs/core/services/app';
import testUtils from '@adonisjs/core/services/test_utils';
import limiter from '@adonisjs/limiter/services/main';
import mail from '@adonisjs/mail/services/main';
import redis from '@adonisjs/redis/services/main';
import { SessionCollection } from '@adonisjs/session';
import { test } from '@japa/runner';
import { DateTime } from 'luxon';

import PasswordResetNotification from '#mails/password_reset_notification';
import VerifyEmailNotification from '#mails/verify_email_notification';
import User from '#models/user';
import {
  AUTH_MAIL_TOKEN_KEY_PREFIX,
  issueEmailVerificationToken,
  issuePasswordResetToken,
} from '#services/auth_tokens';
import { mailCooldownKey } from '#services/mail_cooldown_service';

async function clearAuthRedisKeys() {
  const cooldownKeys = await redis.keys('mail:cooldown:*');
  const tokenKeys = await redis.keys(`${AUTH_MAIL_TOKEN_KEY_PREFIX}*`);
  const keys = [...cooldownKeys, ...tokenKeys];
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

async function clearLoginLimiter() {
  await limiter
    .use({
      requests: 5,
      duration: '15 mins',
      blockDuration: '1 hour',
    })
    .clear();
}

test.group('Auth HTTP', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction());

  group.each.setup(() => {
    return async () => {
      await clearAuthRedisKeys();
      await clearLoginLimiter();
    };
  });

  test('register sends verification email and blocks login until verified', async ({ client, assert }) => {
    using fake = mail.fake();

    const register = await client.post('/api/auth/register').json({
      email: 'alice@example.com',
      username: 'alice',
      password: 'password123',
      fullName: 'Alice',
    });

    register.assertStatus(200);
    assert.equal(register.body().data.email, 'alice@example.com');
    assert.equal(register.body().data.username, 'alice');
    assert.equal(register.body().data.role, 'user');
    assert.isFalse(register.body().data.emailVerified);
    assert.isString(register.body().data.image);
    assert.match(register.body().data.image!, /dicebear/);

    fake.mails.assertSent(VerifyEmailNotification);

    const loginBlocked = await client.post('/api/auth/login').json({
      login: 'alice',
      password: 'password123',
    });
    loginBlocked.assertStatus(403);
    assert.equal((loginBlocked.body() as { code?: string }).code, 'E_EMAIL_NOT_VERIFIED');

    const user = await User.findByOrFail('email', 'alice@example.com');
    const token = await issueEmailVerificationToken({ userId: user.id, email: user.email });

    const verify = await client.get(`/api/auth/email/verify`).qs({ token });
    verify.assertStatus(200);
    assert.isTrue(verify.body().data.emailVerified);

    const verifyAgain = await client.get(`/api/auth/email/verify`).qs({ token });
    verifyAgain.assertStatus(400);
    assert.equal((verifyAgain.body() as { code?: string }).code, 'E_INVALID_EMAIL_TOKEN');

    const login = await client.post('/api/auth/login').json({
      login: 'alice@example.com',
      password: 'password123',
    });
    login.assertStatus(200);
    assert.equal(login.body().data.username, 'alice');
    assert.isUndefined((login.body().data as { value?: string }).value);
    assert.isUndefined((login.body().data as { type?: string }).type);
    login.assertCookie('adonis-session');

    const me = await client.get('/api/auth/me').loginAs(user);
    me.assertStatus(200);
    assert.equal(me.body().data.username, 'alice');

    const logout = await client.delete('/api/auth/logout').loginAs(user);
    logout.assertStatus(200);

    const meAfterLogout = await client.get('/api/auth/me');
    meAfterLogout.assertStatus(401);

    const logoutAgain = await client.delete('/api/auth/logout');
    logoutAgain.assertStatus(200);
  });

  test('resend verification respects redis cooldown', async ({ client, assert }) => {
    using fake = mail.fake();

    await client.post('/api/auth/register').json({
      email: 'bob@example.com',
      username: 'bob',
      password: 'password123',
    });

    fake.mails.assertSent(VerifyEmailNotification);

    const resendBlocked = await client.post('/api/auth/email/resend').json({
      email: 'bob@example.com',
    });
    resendBlocked.assertStatus(429);
    assert.equal((resendBlocked.body() as { code?: string }).code, 'MAIL_SEND_COOLDOWN');

    await redis.del(mailCooldownKey('emailVerification', 'bob@example.com'));

    const resend = await client.post('/api/auth/email/resend').json({
      email: 'bob@example.com',
    });
    resend.assertStatus(200);
    fake.mails.assertSentCount(VerifyEmailNotification, 2);
  });

  test('forgot password cools down unknown emails to avoid enumeration', async ({ client, assert }) => {
    using fake = mail.fake();

    const first = await client.post('/api/auth/password/forgot').json({
      email: 'nobody@example.com',
    });
    first.assertStatus(200);
    fake.mails.assertNotSent(PasswordResetNotification);

    const second = await client.post('/api/auth/password/forgot').json({
      email: 'nobody@example.com',
    });
    second.assertStatus(429);
    assert.equal((second.body() as { code?: string }).code, 'MAIL_SEND_COOLDOWN');
  });

  test('password reset is one-time and destroys tagged sessions', async ({ client, assert }) => {
    using fake = mail.fake();

    const carol = await User.create({
      email: 'carol@example.com',
      username: 'carol',
      password: 'password123',
      role: 'user',
      image: 'https://api.dicebear.com/9.x/lorelei/svg?seed=carol',
      emailVerifiedAt: DateTime.utc(),
    });

    const sessionConfigProvider = app.config.get('session');
    const sessionConfig = (await configProvider.resolve(app, sessionConfigProvider)) as {
      stores: {
        memory: () => {
          write: (sessionId: string, values: Record<string, unknown>) => void;
          tag: (sessionId: string, userId: string | number) => void | Promise<void>;
        };
      };
    };
    assert.isDefined(sessionConfig);

    const sessionId = randomUUID();
    const memoryStore = sessionConfig.stores.memory();
    memoryStore.write(sessionId, { probe: true });
    await memoryStore.tag(sessionId, carol.id);

    const sessionCollection = await app.container.make(SessionCollection);
    assert.isTrue(sessionCollection.supportsTagging());
    assert.lengthOf(await sessionCollection.tagged(String(carol.id)), 1);

    const forgot = await client.post('/api/auth/password/forgot').json({
      email: 'carol@example.com',
    });
    forgot.assertStatus(200);
    fake.mails.assertSent(PasswordResetNotification);

    const resetToken = await issuePasswordResetToken({
      userId: carol.id,
    });

    const reset = await client.post('/api/auth/password/reset').json({
      token: resetToken,
      password: 'newpassword123',
    });
    reset.assertStatus(200);

    const resetAgain = await client.post('/api/auth/password/reset').json({
      token: resetToken,
      password: 'anotherpassword123',
    });
    resetAgain.assertStatus(400);
    assert.equal((resetAgain.body() as { code?: string }).code, 'E_INVALID_PASSWORD_TOKEN');

    assert.lengthOf(await sessionCollection.tagged(String(carol.id)), 0);

    const loginAgain = await client.post('/api/auth/login').json({
      login: 'carol',
      password: 'newpassword123',
    });
    loginAgain.assertStatus(200);
    assert.equal(loginAgain.body().data.username, 'carol');
  });

  test('login penalize blocks after repeated failures', async ({ client }) => {
    const dave = await User.create({
      email: 'dave@example.com',
      username: 'dave',
      password: 'password123',
      fullName: 'Dave',
      role: 'user',
      image: 'https://api.dicebear.com/9.x/lorelei/svg?seed=dave',
      emailVerifiedAt: DateTime.utc(),
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      const failed = await client.post('/api/auth/login').json({
        login: dave.email,
        password: 'wrong-password',
      });
      failed.assertStatus(400);
    }

    const blocked = await client.post('/api/auth/login').json({
      login: dave.email,
      password: 'wrong-password',
    });
    blocked.assertStatus(429);

    const stillBlocked = await client.post('/api/auth/login').json({
      login: dave.email,
      password: 'password123',
    });
    stillBlocked.assertStatus(429);
  });

  test('register rejects duplicate email with 409', async ({ client, assert }) => {
    using fake = mail.fake();

    await client.post('/api/auth/register').json({
      email: 'erin@example.com',
      username: 'erin',
      password: 'password123',
    });
    fake.mails.assertSent(VerifyEmailNotification);

    await redis.del(mailCooldownKey('emailVerification', 'erin@example.com'));

    const duplicate = await client.post('/api/auth/register').json({
      email: 'erin@example.com',
      username: 'erin2',
      password: 'password123',
    });
    duplicate.assertStatus(409);
    assert.equal((duplicate.body() as { code?: string }).code, 'E_USER_EXISTS');
  });
});
