import { Resend } from 'resend';

import type { MailTransport, MailTransportPayload, MailTransportResult } from './transport.js';

export class ResendMailTransport implements MailTransport {
  private client: Resend | null = null;

  constructor(private readonly getApiKey: () => string | undefined = () => process.env.RESEND_API_KEY) {}

  async send(payload: MailTransportPayload): Promise<MailTransportResult> {
    const apiKey = this.getApiKey()?.trim();
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required to send mail');
    }

    this.client ??= new Resend(apiKey);

    const { data, error } = await this.client.emails.send({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.id) {
      throw new Error('Resend returned no message id');
    }

    return { id: data.id };
  }
}
