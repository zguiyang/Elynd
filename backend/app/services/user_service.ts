import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import redis from '@adonisjs/redis/services/main'
import User from '#models/user'
import { EMAIL_VERIFICATION, AVATAR } from '#constants'
import { NotificationService } from '#services/notification_service'

@inject()
export class UserService {
  constructor(private notificationService: NotificationService) {}
  async create(data: { email: string; name: string; password: string }) {
    logger.info({ email: data.email }, 'Creating user')

    const user = await User.create({
      email: data.email,
      fullName: data.name,
      password: data.password,
    })

    logger.info({ userId: user.id }, 'User created')

    return user
  }

  async verifyEmailByUser(userId: number, emailToken: string) {
    // 1. 获取并立即销毁 Token 数据
    const data = await this.getDataFromToken(emailToken)
    if (!data) {
      throw new Exception('验证链接已失效或已过期', { status: 403 })
    }

    const user = await User.findOrFail(userId)

    // 2. 根据类型执行不同业务
    if (data.type === 'change_email') {
      // 更换邮箱场景：更新邮箱地址并设为已验证
      user.email = data.email
      user.isEmailVerified = true
    } else {
      // 注册验证场景：校验邮箱匹配
      if (user.email !== data.email) {
        throw new Exception('邮箱信息不匹配', { status: 403 })
      }
      user.isEmailVerified = true
    }

    await user.save()

    logger.info({ userId: user.id, type: data.type }, 'Email verified')

    return user
  }

  async getDataFromToken(token: string): Promise<{ email: string; type: string } | null> {
    const key = `verify:${token}`
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

  async resetPassword(token: string, newPassword: string) {
    logger.info({ token }, 'Resetting password')

    const data = await this.getDataFromToken(token)
    if (!data || data.type !== 'reset_password') {
      throw new Exception('验证链接已失效或已过期', { status: 403 })
    }

    const user = await User.findBy('email', data.email)
    if (!user) {
      throw new Exception('用户不存在', { status: 404 })
    }

    user.password = newPassword
    await user.save()

    logger.info({ userId: user.id }, 'Password reset')

    return user
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
    const user = await this.findByEmail(email)

    if (!user) {
      throw new Exception('用户不存在', { status: 404 })
    }

    if (!user.isEmailVerified) {
      throw new Exception('请先验证您的邮箱地址', { status: 403 })
    }

    const canSend = await this.checkCanSend(email)
    if (!canSend) {
      throw new Exception('邮件发送过于频繁，请稍后再试', {
        status: 429,
      })
    }

    logger.info({ userId: user.id, email }, 'Sending password reset email')

    const token = await this.storeEmailVerificationToken(email, 'reset_password')

    await this.notificationService.sendPasswordResetEmail(user, token)

    await this.setSendRate(email)

    logger.info({ userId: user.id }, 'Password reset email sent')
  }

  async changeEmail(userId: number, newEmail: string, password: string): Promise<User> {
    const user = await User.findOrFail(userId)

    const isValidPassword = await hash.verify(user.password, password)
    if (!isValidPassword) {
      throw new Exception('Invalid password', { status: 403 })
    }

    if (user.email === newEmail) {
      throw new Exception('New email must be different from current email', { status: 400 })
    }

    const existingUser = await User.findBy('email', newEmail)
    if (existingUser) {
      throw new Exception('Email is already in use', { status: 400 })
    }

    const canSend = await this.checkCanSend(newEmail)
    if (!canSend) {
      throw new Exception('邮件发送过于频繁，请稍后再试', {
        status: 429,
      })
    }

    logger.info({ userId, newEmail }, 'Changing email')

    const emailToken = await this.storeEmailVerificationToken(newEmail, 'change_email')

    await this.notificationService.sendVerificationEmail(newEmail, user.fullName, emailToken)

    await this.setSendRate(newEmail)

    logger.info({ userId, newEmail }, 'Email change initiated, verification email sent')

    return user
  }

  async resendVerificationEmail(userId: number): Promise<void> {
    const user = await User.findOrFail(userId)

    if (user.isEmailVerified) {
      throw new Exception('Email already verified', { status: 400 })
    }

    const canSend = await this.checkCanSend(user.email)
    if (!canSend) {
      throw new Exception('邮件发送过于频繁，请稍后再试', {
        status: 429,
      })
    }

    const emailToken = await this.storeEmailVerificationToken(user.email, 'registration')

    await this.notificationService.sendVerificationEmail(user.email, user.fullName, emailToken)

    await this.setSendRate(user.email)

    logger.info({ userId }, 'Verification email resent')
  }

  async storeEmailVerificationToken(
    email: string,
    type: 'registration' | 'change_email' | 'reset_password' = 'registration'
  ): Promise<string> {
    const emailToken = randomUUID()
    const key = `verify:${emailToken}`
    const data = JSON.stringify({ email, type })

    await redis.set(key, data, 'EX', EMAIL_VERIFICATION.EXPIRY_MINUTES * 60)

    logger.info({ email, type, emailToken }, 'Email verification token stored in Redis')

    return emailToken
  }

  private async checkCanSend(email: string): Promise<boolean> {
    const rateKey = `verify:rate:${email}`
    return !(await redis.exists(rateKey))
  }

  private async setSendRate(email: string): Promise<void> {
    const rateKey = `verify:rate:${email}`
    await redis.set(rateKey, '1', 'EX', EMAIL_VERIFICATION.COOLDOWN_MINUTES * 60)
  }

  async uploadAvatar(userId: number, file: MultipartFile): Promise<string> {
    if (!file.tmpPath) {
      throw new Exception('文件上传失败', { status: 400 })
    }

    const storageDir = path.resolve(process.cwd(), AVATAR.STORAGE_DIR)
    await fs.mkdir(storageDir, { recursive: true })

    const user = await User.findOrFail(userId)
    if (user.avatar) {
      const oldFilename = path.basename(user.avatar)
      const oldPath = path.join(storageDir, oldFilename)
      try {
        await fs.unlink(oldPath)
      } catch {
        logger.warn({ userId, oldAvatar: user.avatar }, 'Failed to delete old avatar')
      }
    }

    const timestamp = Date.now()
    const ext = path.extname(file.clientName).toLowerCase()
    const filename = `${userId}-${timestamp}${ext}`
    const filepath = path.join(storageDir, filename)

    await fs.copyFile(file.tmpPath, filepath)
    await fs.unlink(file.tmpPath)

    user.avatar = `${AVATAR.URL_PREFIX}/${filename}`
    await user.save()

    logger.info({ userId, filename }, 'Avatar uploaded')

    return filename
  }

  async removeAvatar(userId: number): Promise<void> {
    const user = await User.findOrFail(userId)

    if (!user.avatar) {
      return
    }

    const filename = path.basename(user.avatar)
    const filepath = path.resolve(process.cwd(), AVATAR.STORAGE_DIR, filename)
    try {
      await fs.unlink(filepath)
    } catch {
      logger.warn({ userId, avatar: user.avatar }, 'Failed to delete avatar file')
    }

    user.avatar = null
    await user.save()

    logger.info({ userId }, 'Avatar removed')
  }
}
