import { describe, expect, it } from 'vitest';

import { BA_ERROR_EMAIL_NOT_VERIFIED, isAuthRateLimited, isEmailNotVerifiedError } from './auth-errors';

describe('auth-errors', () => {
  it('detects Better Auth email-not-verified code', () => {
    expect(isEmailNotVerifiedError(BA_ERROR_EMAIL_NOT_VERIFIED)).toBe(true);
    expect(isEmailNotVerifiedError('OTHER')).toBe(false);
  });

  it('detects BA rate-limit status and code', () => {
    expect(isAuthRateLimited({ status: 429 })).toBe(true);
    expect(isAuthRateLimited({ code: 'TOO_MANY_REQUESTS' })).toBe(true);
    expect(isAuthRateLimited({ status: 400, code: 'OTHER' })).toBe(false);
    expect(isAuthRateLimited(null)).toBe(false);
  });
});
