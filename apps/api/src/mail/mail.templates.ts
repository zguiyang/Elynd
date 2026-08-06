export type MailTemplateId = 'platformSmoke';

export type MailTemplateVars = {
  platformSmoke: { message: string };
};

export type RenderedMail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderMailTemplate<T extends MailTemplateId>(template: T, vars: MailTemplateVars[T]): RenderedMail {
  if (template === 'platformSmoke') {
    const { message } = vars as MailTemplateVars['platformSmoke'];
    return {
      subject: 'Elynd mail smoke test',
      html: `<p>${escapeHtml(message)}</p>`,
      text: message,
    };
  }

  throw new Error(`Unknown mail template: ${String(template)}`);
}
