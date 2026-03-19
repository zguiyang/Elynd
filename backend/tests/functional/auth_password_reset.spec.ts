import { test } from '@japa/runner'
import crypto from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'
import { EMAIL_VERIFICATION } from '#constants'
import User from '#models/user'
import { NotificationService } from '#services/user/notification_service'
import { AuthService } from '#services/user/auth_service'
import type { UserService } from '#services/user/user_service'
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
    assert,
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

    const beforeResetLoginResponse = await client
      .post('/api/auth/login')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        email,
        password: 'password123',
        rememberMe: false,
      })
    beforeResetLoginResponse.assertStatus(200)
    const beforeResetToken = beforeResetLoginResponse.body().token as string

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

    const oldTokenAccessResponse = await client
      .get('/api/user/me')
      .header('Authorization', `Bearer ${beforeResetToken}`)

    oldTokenAccessResponse.assertStatus(401)
    assert.isTrue(oldTokenAccessResponse.body().error)
    assert.equal(oldTokenAccessResponse.body().message, 'Unauthenticated')

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

  test('POST /api/auth/reset-password does not log raw token in service chain', async ({
    assert,
    client,
    cleanup,
  }) => {
    const originalInfo = logger.info
    const originalWarn = logger.warn
    const logs: string[] = []

    logger.info = (obj: any, message?: string) => {
      logs.push(JSON.stringify({ obj, message }))
    }
    logger.warn = (obj: any, message?: string) => {
      logs.push(JSON.stringify({ obj, message }))
    }

    const email = makeTestEmail('reset-log')
    const user = await User.create({
      fullName: 'Reset Log User',
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
      logger.info = originalInfo
      logger.warn = originalWarn
      await redis.del(getTokenKey(resetToken))
      await user.delete()
    })

    const response = await client
      .post('/api/auth/reset-password')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        token: resetToken,
        password: 'new-password123',
        passwordConfirmation: 'new-password123',
      })

    response.assertStatus(200)

    const mergedLogs = logs.join('\n')
    assert.isFalse(
      mergedLogs.includes(resetToken),
      'Raw reset token must never appear in logs from reset flow'
    )
  })
})

test.group('AuthService token masking', (group) => {
  const originalInfo = logger.info
  const originalWarn = logger.warn
  let infoPayload: any = null
  let warnPayload: any = null

  group.each.setup(() => {
    infoPayload = null
    warnPayload = null
    logger.info = (obj: any) => {
      infoPayload = obj
    }
    logger.warn = (obj: any) => {
      warnPayload = obj
    }
  })

  group.each.teardown(() => {
    logger.info = originalInfo
    logger.warn = originalWarn
  })

  test('resetPassword 调用时日志不包含完整 token', async ({ assert }) => {
    const mockUserService = {
      resetPassword: async () => null,
    } as unknown as UserService

    const authService = new AuthService(mockUserService)

    const fakeToken = 'very-long-token-abcdefgh12345678'
    await authService.resetPassword(fakeToken, 'newpassword')

    assert.isNotNull(infoPayload, 'logger.info should have been called')
    assert.isFalse(
      JSON.stringify(infoPayload).includes(fakeToken),
      'Logged token should be masked, not the original'
    )
    assert.isTrue(
      JSON.stringify(infoPayload).includes('very***5678'),
      'Logged token should contain the masked version'
    )
  })

  test('无效 token 时日志不包含完整 token', async ({ assert }) => {
    const mockUserService = {
      resetPassword: async () => null,
    } as unknown as UserService

    const authService = new AuthService(mockUserService)

    const fakeToken = 'expired-token-xyz1234567890'
    await authService.resetPassword(fakeToken, 'newpassword')

    assert.isNotNull(warnPayload, 'logger.warn should have been called')
    assert.isFalse(
      JSON.stringify(warnPayload).includes(fakeToken),
      'Logged token should be masked, not the original'
    )
  })

  test('token 长度 <= 8 时返回 ***', async ({ assert }) => {
    const authService = new AuthService({} as UserService)

    const shortToken = 'abc'
    const masked = (authService as any).maskToken(shortToken)
    assert.equal(masked, '***')

    const exactEightToken = '12345678'
    const maskedEight = (authService as any).maskToken(exactEightToken)
    assert.equal(maskedEight, '***')
  })
})
