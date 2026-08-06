import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendMail } from './send.js';
import type { MailTransport } from './transport.js';

describe('sendMail', () => {
  const transport: MailTransport = {
    send: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.MAIL_FROM;
  });

  it('resolves the template and delegates to the transport', async () => {
    vi.mocked(transport.send).mockResolvedValue({ id: 'msg_123' });

    const result = await sendMail(
      {
        template: 'platformSmoke',
        to: 'user@example.com',
        vars: { message: 'hello' },
      },
      {
        transport,
        from: 'Elynd <noreply@example.com>',
      },
    );

    expect(result).toEqual({ id: 'msg_123' });
    expect(transport.send).toHaveBeenCalledWith({
      from: 'Elynd <noreply@example.com>',
      to: 'user@example.com',
      subject: 'Elynd mail smoke test',
      html: expect.stringContaining('hello'),
      text: 'hello',
    });
  });

  it('fails fast when MAIL_FROM is not configured', async () => {
    await expect(
      sendMail(
        {
          template: 'platformSmoke',
          to: 'user@example.com',
          vars: { message: 'hello' },
        },
        { transport },
      ),
    ).rejects.toThrow(/MAIL_FROM/);
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('propagates transport failures', async () => {
    vi.mocked(transport.send).mockRejectedValue(new Error('resend failed'));

    await expect(
      sendMail(
        {
          template: 'platformSmoke',
          to: 'user@example.com',
          vars: { message: 'hello' },
        },
        {
          transport,
          from: 'Elynd <noreply@example.com>',
        },
      ),
    ).rejects.toThrow(/resend failed/);
  });
});
