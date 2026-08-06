import { describe, expect, it, vi } from 'vitest';

import { MailCooldownService } from './mail-cooldown.service.js';

describe('MailCooldownService', () => {
  it('marks, detects, and clears cooldown keys with TTL', async () => {
    const store = new Map<string, string>();
    const redis = {
      getClient: () => ({
        exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
        set: vi.fn(async (key: string, value: string, _mode: string, _ttl: number) => {
          store.set(key, value);
          return 'OK';
        }),
        del: vi.fn(async (key: string) => {
          store.delete(key);
          return 1;
        }),
      }),
    };

    const service = new MailCooldownService(redis as never);

    expect(await service.isActive('emailVerification', 'a@b.com')).toBe(false);
    await service.markSent('emailVerification', 'A@B.com');
    expect(await service.isActive('emailVerification', 'a@b.com')).toBe(true);
    expect(store.has('mail:cooldown:emailVerification:a@b.com')).toBe(true);

    await service.clear('emailVerification', 'a@b.com');
    expect(await service.isActive('emailVerification', 'a@b.com')).toBe(false);
  });
});
