import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import { DateTime } from 'luxon'
import User from '#models/user'
import UserTransformer from '#transformers/user_transformer'
import VerifyEmailNotification from '#mails/verify_email_notification'
import PasswordResetNotification from '#mails/password_reset_notification'
import MailCooldownService from '#services/mail_cooldown_service'
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  decryptEmailVerificationToken,
  decryptPasswordResetToken,
} from '#services/auth_tokens'
import { applyUserCreateDefaults } from '#auth/user_create_defaults'
import { normalizeEmail } from '#auth/policy'
import {
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resendVerificationValidator,
  resetPasswordValidator,
  verifyEmailValidator,
} from '#validators/user'

export default class AuthController {
  /**
   * POST /api/v1/auth/register
   */
  async register({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(registerValidator)
    const email = normalizeEmail(payload.email)

    const existing = await User.query()
      .where('email', email)
      .orWhere('username', payload.username)
      .first()
    if (existing) {
      throw new Exception('Email or username is already taken', {
        status: 409,
        code: 'E_USER_EXISTS',
      })
    }

    const cooldown = new MailCooldownService()
    await cooldown.assertAllowed('emailVerification', email)

    const existingUserCount = await User.query().count('* as total')
    const total = Number(existingUserCount[0]!.$extras.total)
    const defaults = applyUserCreateDefaults(total)

    const user = await User.create({
      email,
      username: payload.username,
      password: payload.password,
      fullName: payload.fullName ?? null,
      role: defaults.role,
      image: defaults.image,
      emailVerifiedAt: null,
    })

    await this.#sendVerificationEmail(user)
    await cooldown.mark('emailVerification', email)

    return serialize(UserTransformer.transform(user))
  }

  /**
   * POST /api/v1/auth/login
   */
  async login({ request, auth, serialize }: HttpContext) {
    const { login, password } = await request.validateUsing(loginValidator)
    const user = await User.verifyCredentials(login, password)

    if (!user.isEmailVerified) {
      throw new Exception('Email address is not verified', {
        status: 403,
        code: 'E_EMAIL_NOT_VERIFIED',
      })
    }

    const token = await auth.use('api').createToken(user)
    return serialize({
      type: 'bearer',
      value: token.value!.release(),
      expiresAt: token.expiresAt,
      user: UserTransformer.transform(user),
    })
  }

  /**
   * DELETE /api/v1/auth/logout
   */
  async logout({ auth }: HttpContext) {
    await auth.use('api').invalidateToken()
    return { ok: true }
  }

  /**
   * GET /api/v1/auth/me
   */
  async me({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    return serialize(UserTransformer.transform(user as User))
  }

  /**
   * GET|POST /api/v1/auth/email/verify
   */
  async verifyEmail({ request, serialize }: HttpContext) {
    const queryToken = request.input('token')
    const token =
      typeof queryToken === 'string' && queryToken.length > 0
        ? queryToken
        : (await request.validateUsing(verifyEmailValidator)).token

    const payload = decryptEmailVerificationToken(token)
    const user = await User.findOrFail(payload.userId)

    if (normalizeEmail(user.email) !== normalizeEmail(payload.email)) {
      throw new Exception('Invalid or expired email verification token', {
        status: 400,
        code: 'E_INVALID_EMAIL_TOKEN',
      })
    }

    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = DateTime.utc()
      await user.save()
    }

    await new MailCooldownService().clear('emailVerification', user.email)
    return serialize(UserTransformer.transform(user))
  }

  /**
   * POST /api/v1/auth/email/resend
   */
  async resendVerification({ request }: HttpContext) {
    const { email: rawEmail } = await request.validateUsing(resendVerificationValidator)
    const email = normalizeEmail(rawEmail)
    const cooldown = new MailCooldownService()
    await cooldown.assertAllowed('emailVerification', email)

    const user = await User.findBy('email', email)
    if (user && !user.isEmailVerified) {
      await this.#sendVerificationEmail(user)
      await cooldown.mark('emailVerification', email)
    }

    // Always OK to avoid email enumeration
    return { ok: true }
  }

  /**
   * POST /api/v1/auth/password/forgot
   */
  async forgotPassword({ request }: HttpContext) {
    const { email: rawEmail } = await request.validateUsing(forgotPasswordValidator)
    const email = normalizeEmail(rawEmail)
    const cooldown = new MailCooldownService()
    await cooldown.assertAllowed('passwordReset', email)

    const user = await User.findBy('email', email)
    if (user) {
      const token = createPasswordResetToken({ userId: user.id })
      const resetUrl = `${env.get('APP_URL')}/api/v1/auth/password/reset?token=${encodeURIComponent(token)}`
      await mail.send(new PasswordResetNotification(user, resetUrl))
      await cooldown.mark('passwordReset', email)
    }

    return { ok: true }
  }

  /**
   * POST /api/v1/auth/password/reset
   */
  async resetPassword({ request, serialize }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator)
    const payload = decryptPasswordResetToken(token)
    const user = await User.findOrFail(payload.userId)

    user.password = password
    await user.save()

    // Revoke all access tokens (parity with revokeSessionsOnPasswordReset)
    await User.accessTokens.deleteAll(user)

    await new MailCooldownService().clear('passwordReset', user.email)
    return serialize(UserTransformer.transform(user))
  }

  async #sendVerificationEmail(user: User) {
    const token = createEmailVerificationToken({
      userId: user.id,
      email: user.email,
    })
    const verifyUrl = `${env.get('APP_URL')}/api/v1/auth/email/verify?token=${encodeURIComponent(token)}`
    await mail.send(new VerifyEmailNotification(user, verifyUrl))
  }
}
