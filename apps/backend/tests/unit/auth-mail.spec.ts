import { describe, expect, it } from 'vitest';

import { buildVerificationUrl, shouldLogDevAuthLink } from '@/lib/auth-mail';

describe('auth-mail', () => {
  it('buildVerificationUrl encodes token for verify-email route', () => {
    expect(buildVerificationUrl('abc+def', 'http://localhost:3000')).toBe(
      'http://localhost:3000/verify-email?token=abc%2Bdef',
    );
  });

  it('shouldLogDevAuthLink is true only in development without RESEND_API_KEY', () => {
    expect(shouldLogDevAuthLink({ NODE_ENV: 'development', RESEND_API_KEY: undefined })).toBe(true);
    expect(shouldLogDevAuthLink({ NODE_ENV: 'production', RESEND_API_KEY: undefined })).toBe(false);
    expect(shouldLogDevAuthLink({ NODE_ENV: 'development', RESEND_API_KEY: 're_test_key' })).toBe(false);
    expect(shouldLogDevAuthLink({ NODE_ENV: 'test', RESEND_API_KEY: undefined })).toBe(false);
  });
});
