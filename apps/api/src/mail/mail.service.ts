import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type MailTemplateId, type MailTemplateVars, renderMailTemplate } from './mail.templates.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail.transport.js';

export type MailSendInput<T extends MailTemplateId = MailTemplateId> = {
  template: T;
  to: string;
  vars: MailTemplateVars[T];
};

export type MailSendResult = {
  id: string;
};

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async send<T extends MailTemplateId>(input: MailSendInput<T>): Promise<MailSendResult> {
    const from = this.config.get<string>('MAIL_FROM') ?? process.env.MAIL_FROM;
    if (!from?.trim()) {
      throw new Error('MAIL_FROM is required to send mail');
    }

    const rendered = renderMailTemplate(input.template, input.vars);

    return this.transport.send({
      from,
      to: input.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }
}
