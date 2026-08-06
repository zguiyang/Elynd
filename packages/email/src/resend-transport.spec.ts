import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResendMailTransport } from './resend-transport.js';

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

  it('fails fast when the API key is not configured', async () => {
    const transport = new ResendMailTransport(() => undefined);

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

  it('throws when Resend returns an error object', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'invalid from', name: 'validation_error' },
    });

    const transport = new ResendMailTransport(() => 're_test');

    await expect(
      transport.send({
        from: 'Elynd <noreply@example.com>',
        to: 'user@example.com',
        subject: 'hi',
        html: '<p>hi</p>',
      }),
    ).rejects.toThrow(/invalid from/);
  });

  it('returns the Resend message id', async () => {
    sendMock.mockResolvedValue({
      data: { id: 'msg_abc' },
      error: null,
    });

    const transport = new ResendMailTransport(() => 're_test');

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
