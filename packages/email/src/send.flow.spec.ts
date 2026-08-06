import { describe, expect, it } from 'vitest';

import { sendMail } from './send.js';
import type { MailTransport, MailTransportPayload, MailTransportResult } from './transport.js';

/**
 * In-memory transport: proves sendMail → template → transport without Resend/network.
 * Swap for real Resend later with RESEND_API_KEY + MAIL_FROM (no transport override).
 */
class MockMailTransport implements MailTransport {
  readonly sent: MailTransportPayload[] = [];

  async send(payload: MailTransportPayload): Promise<MailTransportResult> {
    this.sent.push(payload);
    return { id: `mock_${this.sent.length}` };
  }
}

describe('sendMail flow (mock transport)', () => {
  it('sends a password-reset email through the full package path', async () => {
    const transport = new MockMailTransport();
    const resetUrl = 'https://elynd.local/reset-password?token=flow-test-token';

    const result = await sendMail(
      {
        template: 'passwordReset',
        to: 'flow-test@example.com',
        vars: {
          url: resetUrl,
          userName: 'Flow Tester',
        },
      },
      {
        transport,
        from: 'Elynd <noreply@example.com>',
      },
    );

    expect(result.id).toBe('mock_1');
    expect(transport.sent).toHaveLength(1);

    const payload = transport.sent[0]!;
    expect(payload.from).toBe('Elynd <noreply@example.com>');
    expect(payload.to).toBe('flow-test@example.com');
    expect(payload.subject).toContain('密码');
    expect(payload.html).toContain(resetUrl);
    expect(payload.html).toContain('Flow Tester');
    expect(payload.text).toContain(resetUrl);
    expect(payload.text).toContain('Flow Tester');
  });

  it('sends an email-verification message through the full package path', async () => {
    const transport = new MockMailTransport();
    const verifyUrl = 'https://elynd.local/api/auth/verify-email?token=flow-verify-token';

    const result = await sendMail(
      {
        template: 'emailVerification',
        to: 'verify-flow@example.com',
        vars: {
          url: verifyUrl,
          userName: 'Verify Tester',
        },
      },
      {
        transport,
        from: 'Elynd <noreply@example.com>',
      },
    );

    expect(result.id).toBe('mock_1');
    expect(transport.sent).toHaveLength(1);

    const payload = transport.sent[0]!;
    expect(payload.to).toBe('verify-flow@example.com');
    expect(payload.subject).toContain('邮箱');
    expect(payload.html).toContain(verifyUrl);
    expect(payload.html).toContain('Verify Tester');
    expect(payload.text).toContain(verifyUrl);
  });
});
