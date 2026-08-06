import { ResendMailTransport } from './resend-transport.js';
import { type MailTemplateId, type MailTemplateVars, renderMailTemplate } from './templates.js';
import type { MailTransport } from './transport.js';

export type MailSendInput<T extends MailTemplateId = MailTemplateId> = {
  template: T;
  to: string;
  vars: MailTemplateVars[T];
};

export type MailSendResult = {
  id: string;
};

export type SendMailOptions = {
  /** Override for tests; defaults to Resend using `RESEND_API_KEY`. */
  transport?: MailTransport;
  /** Override for tests; defaults to `MAIL_FROM`. */
  from?: string;
};

const defaultTransport = new ResendMailTransport();

/**
 * Framework-agnostic transactional send. Server-only (API keys in env).
 */
export async function sendMail<T extends MailTemplateId>(
  input: MailSendInput<T>,
  options: SendMailOptions = {},
): Promise<MailSendResult> {
  const from = (options.from ?? process.env.MAIL_FROM)?.trim();
  if (!from) {
    throw new Error('MAIL_FROM is required to send mail');
  }

  const rendered = renderMailTemplate(input.template, input.vars);
  const transport = options.transport ?? defaultTransport;

  return transport.send({
    from,
    to: input.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}
