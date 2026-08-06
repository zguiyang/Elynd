import { describe, expect, it } from 'vitest';

import { AUTH_MAIL_COOLDOWN_ERROR_CODE } from '@elynd/auth/policy';

import { resolveMailCooldownErrorMessage } from './mail-cooldown';

describe('resolveMailCooldownErrorMessage', () => {
  it('maps the stable cooldown error code', () => {
    expect(
      resolveMailCooldownErrorMessage({
        code: AUTH_MAIL_COOLDOWN_ERROR_CODE,
        message: '请使用已发送的邮件，30 分钟内无需重复发送',
      }),
    ).toContain('30');
  });

  it('returns null for unrelated errors', () => {
    expect(resolveMailCooldownErrorMessage({ code: 'OTHER', message: 'nope' })).toBeNull();
  });
});
