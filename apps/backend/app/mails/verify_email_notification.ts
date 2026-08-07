import User from '#models/user'
import { BaseMail } from '@adonisjs/mail'

export default class VerifyEmailNotification extends BaseMail {
  subject = '确认你的 Elynd 邮箱'

  constructor(
    private user: User,
    private verifyUrl: string
  ) {
    super()
  }

  prepare() {
    this.message
      .to(this.user.email)
      .htmlView('emails/verify_email', {
        userName: this.user.fullName || this.user.username,
        verifyUrl: this.verifyUrl,
      })
      .textView('emails/verify_email_text', {
        userName: this.user.fullName || this.user.username,
        verifyUrl: this.verifyUrl,
      })
  }
}
