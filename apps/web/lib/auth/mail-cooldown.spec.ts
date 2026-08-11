import { describe, expect, it } from 'vitest';

import { AUTH_MAIL_COOLDOWN_ERROR_CODE } from '@elynd/shared/auth/policy';

import { resolveMailCooldownErrorMessage } from './mail-cooldown';

describe('resolveMailCooldownErrorMessage', () => {
  it('maps the legacy cooldown error code', () => {
    expect(
      resolveMailCooldownErrorMessage({
        code: AUTH_MAIL_COOLDOWN_ERROR_CODE,
        message: '重置密码邮件已发送，请 10 分钟后再试重发',
      }),
    ).toContain('10');
  });

  it('maps Better Auth rate-limit 429', () => {
    expect(resolveMailCooldownErrorMessage({ status: 429, message: 'Too many requests' })).toContain(
      'Too many requests',
    );
    expect(resolveMailCooldownErrorMessage({ status: 429 })).toContain('稍后再试');
  });

  it('returns null for unrelated errors', () => {
    expect(resolveMailCooldownErrorMessage({ code: 'OTHER', message: 'nope' })).toBeNull();
  });
});
