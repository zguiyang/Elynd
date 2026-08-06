export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

export type MailTransportPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type MailTransportResult = {
  id: string;
};

export interface MailTransport {
  send(payload: MailTransportPayload): Promise<MailTransportResult>;
}
