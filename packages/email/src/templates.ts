export type MailTemplateId = 'platformSmoke' | 'passwordReset' | 'emailVerification';

export type MailTemplateVars = {
  platformSmoke: { message: string };
  passwordReset: { url: string; userName?: string };
  emailVerification: { url: string; userName?: string };
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

  if (template === 'passwordReset') {
    const { url, userName } = vars as MailTemplateVars['passwordReset'];
    const greeting = userName?.trim() ? `${userName.trim()}，你好` : '你好';
    const subject = '重置你的 Elynd 密码';
    const text = [
      `${greeting}：`,
      '',
      '我们收到了重置密码的请求。打开下面的链接设置新密码（约 1 小时内有效）：',
      url,
      '',
      '如果不是你本人操作，可以忽略这封邮件。',
    ].join('\n');

    return {
      subject,
      html: [
        `<p>${escapeHtml(greeting)}：</p>`,
        '<p>我们收到了重置密码的请求。点击下面的链接设置新密码（约 1 小时内有效）：</p>',
        `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
        '<p>如果不是你本人操作，可以忽略这封邮件。</p>',
      ].join(''),
      text,
    };
  }

  if (template === 'emailVerification') {
    const { url, userName } = vars as MailTemplateVars['emailVerification'];
    const greeting = userName?.trim() ? `${userName.trim()}，你好` : '你好';
    const subject = '确认你的 Elynd 邮箱';
    const text = [
      `${greeting}：`,
      '',
      '请打开下面的链接确认邮箱（约 1 小时内有效）。确认后即可登录使用：',
      url,
      '',
      '如果不是你本人注册，可以忽略这封邮件。',
    ].join('\n');

    return {
      subject,
      html: [
        `<p>${escapeHtml(greeting)}：</p>`,
        '<p>请点击下面的链接确认邮箱（约 1 小时内有效）。确认后即可登录使用：</p>',
        `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
        '<p>如果不是你本人注册，可以忽略这封邮件。</p>',
      ].join(''),
      text,
    };
  }

  throw new Error(`Unknown mail template: ${String(template)}`);
}
