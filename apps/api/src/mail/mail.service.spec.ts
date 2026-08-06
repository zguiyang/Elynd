import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MailService } from './mail.service.js';
import type { MailTransport } from './mail.transport.js';

describe('MailService', () => {
  const transport: MailTransport = {
    send: vi.fn(),
  };

  let service: MailService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new MailService(transport, {
      get: (key: string) => {
        if (key === 'MAIL_FROM') {
          return 'Elynd <noreply@example.com>';
        }
        return undefined;
      },
    } as never);
  });

  describe('MAIL-001 send platformSmoke', () => {
    it('resolves the template and delegates to the transport', async () => {
      vi.mocked(transport.send).mockResolvedValue({ id: 'msg_123' });

      const result = await service.send({
        template: 'platformSmoke',
        to: 'user@example.com',
        vars: { message: 'hello' },
      });

      expect(result).toEqual({ id: 'msg_123' });
      expect(transport.send).toHaveBeenCalledWith({
        from: 'Elynd <noreply@example.com>',
        to: 'user@example.com',
        subject: 'Elynd mail smoke test',
        html: expect.stringContaining('hello'),
        text: 'hello',
      });
    });
  });

  describe('MAIL-002 missing MAIL_FROM', () => {
    it('fails fast when MAIL_FROM is not configured', async () => {
      service = new MailService(transport, {
        get: () => undefined,
      } as never);

      await expect(
        service.send({
          template: 'platformSmoke',
          to: 'user@example.com',
          vars: { message: 'hello' },
        }),
      ).rejects.toThrow(/MAIL_FROM/);
      expect(transport.send).not.toHaveBeenCalled();
    });
  });

  describe('MAIL-003 transport error', () => {
    it('propagates transport failures', async () => {
      vi.mocked(transport.send).mockRejectedValue(new Error('resend failed'));

      await expect(
        service.send({
          template: 'platformSmoke',
          to: 'user@example.com',
          vars: { message: 'hello' },
        }),
      ).rejects.toThrow(/resend failed/);
    });
  });
});
