import { test } from '@japa/runner'
import crypto from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import { EMAIL_VERIFICATION } from '#constants'
import User from '#models/user'
import { NotificationService } from '#services/notification_service'
import { makeForwardedFor, makeTestEmail } from '#tests/helpers/auth'

function getTokenKey(token: string) {
  return `${EMAIL_VERIFICATION.KEY_PREFIX}${token}`
}

function getRateKey(email: string) {
  return `${EMAIL_VERIFICATION.KEY_PREFIX}rate:${email}`
}

test.group('Auth API password reset contract', () => {
  test('POST /api/auth/forgot-password sends reset email for an existing user and ignores unknown email', async ({
    assert,
    client,
    cleanup,
  }) => {
    const email = makeTestEmail('forgot')
    const user = await User.create({
      fullName: 'Forgot Password User',
      email,
      password: 'password123',
      isAdmin: false,
    })

    let sentEmail: string | null = null
    let sentToken: string | null = null

    const originalSendPasswordResetEmail = NotificationService.prototype.sendPasswordResetEmail
    NotificationService.prototype.sendPasswordResetEmail =
      async function fakeSendPasswordResetEmail(fakeUser, token) {
        sentEmail = fakeUser.email
        sentToken = token
      }

    cleanup(async () => {
      NotificationService.prototype.sendPasswordResetEmail = originalSendPasswordResetEmail
      if (sentToken) {
        await redis.del(getTokenKey(sentToken))
      }
      await redis.del(getRateKey(email))
      await user.delete()
    })

    const existingUserResponse = await client
      .post('/api/auth/forgot-password')
      .header('x-forwarded-for', makeForwardedFor())
      .json({ email })

    existingUserResponse.assertStatus(200)
    assert.equal(sentEmail, email)
    assert.isString(sentToken)
    assert.isAbove((sentToken || '').length, 0)

    sentEmail = null

    const unknownEmailResponse = await client
      .post('/api/auth/forgot-password')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        email: makeTestEmail('missing'),
      })

    unknownEmailResponse.assertStatus(200)
    assert.isNull(sentEmail)
  })

  test('POST /api/auth/reset-password consumes a reset token and only the new password can log in afterwards', async ({
    client,
    cleanup,
  }) => {
    const email = makeTestEmail('reset')
    const user = await User.create({
      fullName: 'Reset Password User',
      email,
      password: 'password123',
      isAdmin: false,
    })

    const resetToken = crypto.randomUUID()

    await redis.set(
      getTokenKey(resetToken),
      JSON.stringify({ email, type: 'reset_password' }),
      'EX',
      EMAIL_VERIFICATION.EXPIRY_MINUTES * 60
    )

    cleanup(async () => {
      await redis.del(getTokenKey(resetToken))
      await user.delete()
    })

    const resetResponse = await client
      .post('/api/auth/reset-password')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        token: resetToken,
        password: 'new-password123',
        passwordConfirmation: 'new-password123',
      })

    resetResponse.assertStatus(200)

    const oldPasswordLoginResponse = await client
      .post('/api/auth/login')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        email,
        password: 'password123',
        rememberMe: false,
      })

    oldPasswordLoginResponse.assertStatus(400)

    const newPasswordLoginResponse = await client
      .post('/api/auth/login')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        email,
        password: 'new-password123',
        rememberMe: false,
      })

    newPasswordLoginResponse.assertStatus(200)

    const reusedTokenResponse = await client
      .post('/api/auth/reset-password')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        token: resetToken,
        password: 'another-password123',
        passwordConfirmation: 'another-password123',
      })

    reusedTokenResponse.assertStatus(403)
  })
})
