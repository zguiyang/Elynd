import { Global, Module } from '@nestjs/common';

import { ResendMailTransport } from './mail.resend-transport.js';
import { MailService } from './mail.service.js';
import { MAIL_TRANSPORT } from './mail.transport.js';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      useClass: ResendMailTransport,
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
