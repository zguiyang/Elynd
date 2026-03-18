import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import ResetPasswordNotification from '#mails/reset_password_notification'
import mail from '@adonisjs/mail/services/main'

@inject()
export class NotificationService {
  async sendPasswordResetEmail(user: User, token: string): Promise<void> {
    logger.info({ userId: user.id }, 'Sending password reset email')

    await mail.send(new ResetPasswordNotification(user, token))

    logger.info({ userId: user.id }, 'Password reset email sent')
  }
}
