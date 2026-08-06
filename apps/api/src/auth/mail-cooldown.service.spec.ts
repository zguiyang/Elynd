import { describe, expect, it, vi } from 'vitest';

import { MailCooldownService } from './mail-cooldown.service.js';

describe('MailCooldownService', () => {
  function createService() {
    const store = new Map<string, { value: string; ttl?: number }>();
    const redis = {
      getClient: () => ({
        exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
        set: vi.fn(async (key: string, value: string, _mode: string, ttl: number) => {
          store.set(key, { value, ttl });
          return 'OK';
        }),
        del: vi.fn(async (key: string) => {
          store.delete(key);
          return 1;
        }),
      }),
    };
    return { service: new MailCooldownService(redis as never), store };
  }

  it('marks, detects, and clears cooldown keys with purpose TTL', async () => {
    const { service, store } = createService();

    expect(await service.isActive('emailVerification', 'a@b.com')).toBe(false);
    await service.markSent('emailVerification', 'A@B.com');
    expect(await service.isActive('emailVerification', 'a@b.com')).toBe(true);
    expect(store.get('mail:cooldown:emailVerification:a@b.com')?.ttl).toBe(30 * 60);

    await service.clear('emailVerification', 'a@b.com');
    expect(await service.isActive('emailVerification', 'a@b.com')).toBe(false);
  });

  it('keeps emailVerification and passwordReset cooldowns independent', async () => {
    const { service, store } = createService();

    await service.markSent('emailVerification', 'a@b.com');
    expect(await service.isActive('emailVerification', 'a@b.com')).toBe(true);
    expect(await service.isActive('passwordReset', 'a@b.com')).toBe(false);

    await service.markSent('passwordReset', 'a@b.com');
    expect(store.get('mail:cooldown:passwordReset:a@b.com')?.ttl).toBe(10 * 60);
    expect(await service.isActive('passwordReset', 'a@b.com')).toBe(true);
    expect(await service.isActive('emailVerification', 'a@b.com')).toBe(true);
  });
});
