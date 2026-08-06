import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResendMailTransport } from './mail.resend-transport.js';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: sendMock,
    };
  },
}));

describe('ResendMailTransport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('MAIL-004 missing RESEND_API_KEY', () => {
    it('fails fast when the API key is not configured', async () => {
      const transport = new ResendMailTransport({
        get: () => undefined,
      } as never);

      await expect(
        transport.send({
          from: 'Elynd <noreply@example.com>',
          to: 'user@example.com',
          subject: 'hi',
          html: '<p>hi</p>',
        }),
      ).rejects.toThrow(/RESEND_API_KEY/);
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe('MAIL-005 resend error payload', () => {
    it('throws when Resend returns an error object', async () => {
      sendMock.mockResolvedValue({
        data: null,
        error: { message: 'invalid from', name: 'validation_error' },
      });

      const transport = new ResendMailTransport({
        get: (key: string) => (key === 'RESEND_API_KEY' ? 're_test' : undefined),
      } as never);

      await expect(
        transport.send({
          from: 'Elynd <noreply@example.com>',
          to: 'user@example.com',
          subject: 'hi',
          html: '<p>hi</p>',
        }),
      ).rejects.toThrow(/invalid from/);
    });
  });

  describe('MAIL-006 resend success', () => {
    it('returns the Resend message id', async () => {
      sendMock.mockResolvedValue({
        data: { id: 'msg_abc' },
        error: null,
      });

      const transport = new ResendMailTransport({
        get: (key: string) => (key === 'RESEND_API_KEY' ? 're_test' : undefined),
      } as never);

      await expect(
        transport.send({
          from: 'Elynd <noreply@example.com>',
          to: 'user@example.com',
          subject: 'hi',
          html: '<p>hi</p>',
          text: 'hi',
        }),
      ).resolves.toEqual({ id: 'msg_abc' });
    });
  });
});
