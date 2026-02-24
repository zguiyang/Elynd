import { BaseMail } from '@adonisjs/mail'
import User from '#models/user'
import env from '#start/env'

export default class ResetPasswordNotification extends BaseMail {
  constructor(
    private user: User,
    private token: string
  ) {
    super()
  }

  from = env.get('MAIL_FROM_ADDRESS')
  subject = 'Reset Your Password - Elynd'

  prepare() {
    const resetUrl = `${env.get('CLIENT_URL')}/auth/reset-password?token=${this.token}`

    this.message.to(this.user.email).htmlView('emails/reset_password', {
      user: this.user,
      resetUrl,
    })
  }
}
