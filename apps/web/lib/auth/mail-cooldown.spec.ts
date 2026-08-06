import { describe, expect, it } from 'vitest';

import { AUTH_MAIL_COOLDOWN_ERROR_CODE } from '@elynd/auth/policy';

import { resolveMailCooldownErrorMessage } from './mail-cooldown';

describe('resolveMailCooldownErrorMessage', () => {
  it('maps the stable cooldown error code', () => {
    expect(
      resolveMailCooldownErrorMessage({
        code: AUTH_MAIL_COOLDOWN_ERROR_CODE,
        message: '重置密码邮件已发送，请 10 分钟后再试重发',
      }),
    ).toContain('10');
  });

  it('returns null for unrelated errors', () => {
    expect(resolveMailCooldownErrorMessage({ code: 'OTHER', message: 'nope' })).toBeNull();
  });
});
