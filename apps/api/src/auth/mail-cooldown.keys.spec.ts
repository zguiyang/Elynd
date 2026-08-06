import { describe, expect, it } from 'vitest';

import { mailCooldownKey, normalizeMailCooldownEmail } from './mail-cooldown.keys.js';

describe('mailCooldownKey', () => {
  it('normalizes email and namespaces by purpose', () => {
    expect(normalizeMailCooldownEmail('  Ada@Example.COM ')).toBe('ada@example.com');
    expect(mailCooldownKey('emailVerification', 'Ada@Example.COM')).toBe(
      'mail:cooldown:emailVerification:ada@example.com',
    );
    expect(mailCooldownKey('passwordReset', 'a@b.com')).toBe('mail:cooldown:passwordReset:a@b.com');
  });
});
