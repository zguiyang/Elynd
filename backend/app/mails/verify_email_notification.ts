import { BaseMail } from '@adonisjs/mail'
import env from '#start/env'

export default class VerifyEmailNotification extends BaseMail {
  constructor(
    private email: string,
    private name: string | null,
    private emailToken: string
  ) {
    super()
  }

  from = env.get('MAIL_FROM_ADDRESS')
  subject = 'Verify Your Email Address - Elynd'

  prepare() {
    const verifyUrl = `${env.get('CLIENT_URL')}/verify-email?emailToken=${this.emailToken}`

    this.message.to(this.email).htmlView('emails/verify_email', {
      email: this.email,
      name: this.name,
      verifyUrl,
    })
  }
}
