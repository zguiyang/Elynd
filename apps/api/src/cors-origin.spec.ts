import { describe, expect, it } from 'vitest';

import { resolveCorsOrigin } from './cors-origin.js';

describe('resolveCorsOrigin', () => {
  it('returns the trusted origins allowlist for Nest CORS', () => {
    const origins = ['http://localhost:3000', 'https://app.example.com'];
    expect(resolveCorsOrigin(origins)).toEqual(origins);
  });

  it('returns false when the allowlist is empty (never reflects any origin)', () => {
    expect(resolveCorsOrigin([])).toBe(false);
  });
});
