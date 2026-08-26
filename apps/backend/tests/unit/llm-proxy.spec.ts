import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildProxiedFetch } from '@/lib/llm/proxy';

describe('buildProxiedFetch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns undefined when neither proxyUrl nor env proxy vars exist (direct path)', () => {
    expect(buildProxiedFetch(null)).toBeUndefined();
  });

  it('uses the explicit proxyUrl when configured', () => {
    const wrapped = buildProxiedFetch('http://127.0.0.1:7897');
    expect(typeof wrapped).toBe('function');
  });

  it('falls back to env vars when proxyUrl is absent', () => {
    vi.stubEnv('http_proxy', 'http://127.0.0.1:7897');
    expect(typeof buildProxiedFetch(null)).toBe('function');
  });

  it('env fallback respects uppercase proxy vars', () => {
    vi.stubEnv('HTTPS_PROXY', 'http://127.0.0.1:7897');
    expect(typeof buildProxiedFetch(null)).toBe('function');
  });
});
