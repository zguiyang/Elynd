import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import { randomUUID } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import User from '#models/user'
import { EMAIL_VERIFICATION } from '#constants'
import { NotificationService } from '#services/notification_service'

@inject()
export class UserService {
  constructor(private notificationService: NotificationService) {}
  async create(data: { email: string; name: string; password: string }) {
    logger.info({ email: data.email }, 'Creating user')

    const avatarSeed = randomUUID()
    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}`

    const userCount = await User.query().count('* as total').first()
    const isFirstUser = Number(userCount?.$extras.total) === 0

    const user = await User.create({
      email: data.email,
      fullName: data.name,
      password: data.password,
      avatar: avatarUrl,
      isAdmin: isFirstUser,
    })

    logger.info({ userId: user.id, isFirstUser }, 'User created')

    return user
  }

  async resetPassword(token: string, newPassword: string) {
    logger.info({ token }, 'Resetting password')

    const data = await this.getDataFromToken(token)
    if (!data || data.type !== 'reset_password') {
      throw new Exception('Invalid or expired reset token', { status: 403 })
    }

    const user = await User.findBy('email', data.email)
    if (!user) {
      throw new Exception('User not found', { status: 404 })
    }

    user.password = newPassword
    await user.save()

    logger.info({ userId: user.id }, 'Password reset')

    return user
  }

  async getDataFromToken(token: string): Promise<{ email: string; type: string } | null> {
    const key = `${EMAIL_VERIFICATION.KEY_PREFIX}${token}`
    const rawData = await redis.getdel(key)
    if (!rawData) {
      return null
    }
    try {
      return JSON.parse(rawData)
    } catch {
      // 兼容老版本存储的纯字符串 email
      return { email: rawData, type: 'registration' }
    }
  }

  async findByEmail(email: string) {
    return User.findBy('email', email)
  }

  async findById(userId: number) {
    return User.findOrFail(userId)
  }

  async update(userId: number, data: { fullName?: string | null }) {
    logger.info({ userId }, 'Updating user')

    const user = await User.findOrFail(userId)

    if (data.fullName !== undefined) {
      user.fullName = data.fullName
    }

    await user.save()

    logger.info({ userId }, 'User updated')

    return user
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    logger.info({ email }, 'Password reset requested')

    const user = await this.findByEmail(email)

    if (!user) {
      logger.debug({ email }, 'Password reset requested for non-existent email')
      return
    }

    const canSend = await this.checkCanSend(email)
    if (!canSend) {
      logger.warn({ email }, 'Password reset rate limited')
      throw new Exception('Too many requests, please try again later', {
        status: 429,
      })
    }

    logger.info({ userId: user.id, email }, 'Sending password reset email')

    const token = await this.storeEmailVerificationToken(email, 'reset_password')

    await this.notificationService.sendPasswordResetEmail(user, token)

    await this.setSendRate(email)

    logger.info({ userId: user.id }, 'Password reset email sent')
  }

  async storeEmailVerificationToken(email: string, type: 'reset_password'): Promise<string> {
    const emailToken = randomUUID()
    const key = `${EMAIL_VERIFICATION.KEY_PREFIX}${emailToken}`
    const data = JSON.stringify({ email, type })

    await redis.set(key, data, 'EX', EMAIL_VERIFICATION.EXPIRY_MINUTES * 60)

    logger.info({ email, type, emailToken }, 'Email verification token stored in Redis')

    return emailToken
  }

  private async checkCanSend(email: string): Promise<boolean> {
    const rateKey = `${EMAIL_VERIFICATION.KEY_PREFIX}rate:${email}`
    return !(await redis.exists(rateKey))
  }

  private async setSendRate(email: string): Promise<void> {
    const rateKey = `${EMAIL_VERIFICATION.KEY_PREFIX}rate:${email}`
    await redis.set(rateKey, '1', 'EX', EMAIL_VERIFICATION.COOLDOWN_MINUTES * 60)
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    logger.info({ userId }, 'Changing password')

    const user = await User.findOrFail(userId)

    const isValid = await user.verifyPassword(currentPassword)
    if (!isValid) {
      throw new Exception('Current password is incorrect', { status: 400 })
    }

    user.password = newPassword
    await user.save()

    logger.info({ userId }, 'Password changed successfully')

    return user
  }
}
