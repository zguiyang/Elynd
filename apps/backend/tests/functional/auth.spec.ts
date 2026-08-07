import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import redis from '@adonisjs/redis/services/main'
import { DateTime } from 'luxon'
import User from '#models/user'
import VerifyEmailNotification from '#mails/verify_email_notification'
import PasswordResetNotification from '#mails/password_reset_notification'
import { mailCooldownKey } from '#services/mail_cooldown_service'
import { createEmailVerificationToken, createPasswordResetToken } from '#services/auth_tokens'

test.group('Auth HTTP', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  group.each.setup(() => {
    return async () => {
      const keys = await redis.keys('mail:cooldown:*')
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    }
  })

  test('register sends verification email and blocks login until verified', async ({
    client,
    assert,
  }) => {
    using fake = mail.fake()

    const register = await client.post('/api/v1/auth/register').json({
      email: 'alice@example.com',
      username: 'alice',
      password: 'password123',
      fullName: 'Alice',
    })

    register.assertStatus(200)
    assert.equal(register.body().data.email, 'alice@example.com')
    assert.equal(register.body().data.username, 'alice')
    assert.equal(register.body().data.role, 'admin')
    assert.isFalse(register.body().data.emailVerified)
    assert.match(register.body().data.image, /dicebear/)

    fake.mails.assertSent(VerifyEmailNotification)

    const loginBlocked = await client.post('/api/v1/auth/login').json({
      login: 'alice',
      password: 'password123',
    })
    loginBlocked.assertStatus(403)
    assert.equal(loginBlocked.body().code, 'E_EMAIL_NOT_VERIFIED')

    const user = await User.findByOrFail('email', 'alice@example.com')
    const token = createEmailVerificationToken({ userId: user.id, email: user.email })

    const verify = await client.get(`/api/v1/auth/email/verify`).qs({ token })
    verify.assertStatus(200)
    assert.isTrue(verify.body().data.emailVerified)

    const login = await client.post('/api/v1/auth/login').json({
      login: 'alice@example.com',
      password: 'password123',
    })
    login.assertStatus(200)
    assert.equal(login.body().data.type, 'bearer')
    assert.isString(login.body().data.value)

    const me = await client.get('/api/v1/auth/me').bearerToken(login.body().data.value)
    me.assertStatus(200)
    assert.equal(me.body().data.username, 'alice')

    const logout = await client.delete('/api/v1/auth/logout').bearerToken(login.body().data.value)
    logout.assertStatus(200)
  })

  test('resend verification respects redis cooldown', async ({ client, assert }) => {
    using fake = mail.fake()

    await client.post('/api/v1/auth/register').json({
      email: 'bob@example.com',
      username: 'bob',
      password: 'password123',
    })

    fake.mails.assertSent(VerifyEmailNotification)

    const resendBlocked = await client.post('/api/v1/auth/email/resend').json({
      email: 'bob@example.com',
    })
    resendBlocked.assertStatus(429)
    assert.equal(resendBlocked.body().code, 'MAIL_SEND_COOLDOWN')

    await redis.del(mailCooldownKey('emailVerification', 'bob@example.com'))

    const resend = await client.post('/api/v1/auth/email/resend').json({
      email: 'bob@example.com',
    })
    resend.assertStatus(200)
    fake.mails.assertSentCount(VerifyEmailNotification, 2)
  })

  test('password reset revokes access tokens', async ({ client, assert }) => {
    using fake = mail.fake()

    const user = await User.create({
      email: 'carol@example.com',
      username: 'carol',
      password: 'password123',
      role: 'user',
      image: 'https://api.dicebear.com/9.x/lorelei/svg?seed=carol',
      emailVerifiedAt: DateTime.utc(),
    })

    const token = await User.accessTokens.create(user)
    const bearer = token.value!.release()

    const forgot = await client.post('/api/v1/auth/password/forgot').json({
      email: 'carol@example.com',
    })
    forgot.assertStatus(200)
    fake.mails.assertSent(PasswordResetNotification)

    const resetToken = createPasswordResetToken({ userId: user.id })

    const reset = await client.post('/api/v1/auth/password/reset').json({
      token: resetToken,
      password: 'newpassword123',
    })
    reset.assertStatus(200)

    const me = await client.get('/api/v1/auth/me').bearerToken(bearer)
    me.assertStatus(401)

    const login = await client.post('/api/v1/auth/login').json({
      login: 'carol',
      password: 'newpassword123',
    })
    login.assertStatus(200)
    assert.equal(login.body().data.type, 'bearer')
  })
})
