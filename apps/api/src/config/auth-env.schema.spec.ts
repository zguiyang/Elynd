import { describe, expect, it } from 'vitest';

import { parseTrustedOrigins } from './auth-env.schema.js';

describe('parseTrustedOrigins', () => {
  it('splits comma-separated origins and trims whitespace', () => {
    expect(parseTrustedOrigins('http://localhost:3000, https://app.example.com')).toEqual([
      'http://localhost:3000',
      'https://app.example.com',
    ]);
  });

  it('drops empty segments', () => {
    expect(parseTrustedOrigins('http://localhost:3000,, ')).toEqual(['http://localhost:3000']);
  });
});
