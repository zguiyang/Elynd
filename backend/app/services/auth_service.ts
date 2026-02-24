import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import { UserService } from '#services/user_service'

@inject()
export class AuthService {
  constructor(private userService: UserService) {}

  async register(data: { email: string; name: string; password: string }) {
    logger.info({ email: data.email }, 'Registration attempt')

    const user = await this.userService.create(data)
    await this.userService.resendVerificationEmail(user.id)

    const token = await User.accessTokens.create(user)

    logger.info({ userId: user.id }, 'Registration successful')

    return { user, token }
  }

  async login(email: string, password: string, rememberMe: boolean = false) {
    logger.info({ email, rememberMe }, 'Login attempt')

    const user = await User.verifyCredentials(email, password)

    const expiresIn = rememberMe ? '30 days' : '7 days'

    const token = await User.accessTokens.create(user, ['*'], { expiresIn })

    logger.info({ userId: user.id, rememberMe }, 'Login successful')

    return { user, token }
  }

  async requestPasswordReset(email: string): Promise<void> {
    logger.info({ email }, 'Password reset request')

    await this.userService.sendPasswordResetEmail(email)
  }

  async resetPassword(token: string, newPassword: string) {
    logger.info({ token }, 'Password reset attempt')

    const user = await this.userService.resetPassword(token, newPassword)

    if (!user) {
      logger.warn({ token }, 'Invalid or expired reset token')
      return null
    }

    logger.info({ userId: user.id }, 'Password reset successful')

    return user
  }
}
