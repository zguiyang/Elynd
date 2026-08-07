import type User from '#models/user'
import { BaseMail } from '@adonisjs/mail'

export default class PasswordResetNotification extends BaseMail {
  subject = '重置你的 Elynd 密码'

  constructor(
    private user: User,
    private resetUrl: string
  ) {
    super()
  }

  prepare() {
    this.message
      .to(this.user.email)
      .htmlView('emails/password_reset', {
        userName: this.user.fullName || this.user.username,
        resetUrl: this.resetUrl,
      })
      .textView('emails/password_reset_text', {
        userName: this.user.fullName || this.user.username,
        resetUrl: this.resetUrl,
      })
  }
}
