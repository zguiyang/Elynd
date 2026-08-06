import { describe, expect, it } from 'vitest';

import {
  applyUserCreateDefaults,
  AUTH_ADMIN_ROLE,
  AUTH_DEFAULT_ROLE,
  buildDiceBearAvatarUrl,
  DICEBEAR_CARTOON_STYLES,
  isDiceBearAvatarUrl,
  resolveSignupRole,
} from './user-create-defaults.js';

describe('resolveSignupRole', () => {
  it('returns admin when no users exist yet', () => {
    expect(resolveSignupRole(0)).toBe(AUTH_ADMIN_ROLE);
  });

  it('returns user when at least one user already exists', () => {
    expect(resolveSignupRole(1)).toBe(AUTH_DEFAULT_ROLE);
    expect(resolveSignupRole(42)).toBe(AUTH_DEFAULT_ROLE);
  });
});

describe('buildDiceBearAvatarUrl', () => {
  it('builds a 9.x SVG URL with an approved style and seed', () => {
    const url = buildDiceBearAvatarUrl({ style: 'lorelei', seed: 'seed-one' });
    expect(url).toBe('https://api.dicebear.com/9.x/lorelei/svg?seed=seed-one');
    expect(isDiceBearAvatarUrl(url)).toBe(true);
  });

  it('URI-encodes the seed', () => {
    const url = buildDiceBearAvatarUrl({ style: 'croodles', seed: 'a b/c' });
    expect(url).toContain('seed=a%20b%2Fc');
  });

  it('picks a style from the cartoon pool when random', () => {
    const url = buildDiceBearAvatarUrl({ seed: 'fixed' });
    expect(isDiceBearAvatarUrl(url)).toBe(true);
    const style = url.slice('https://api.dicebear.com/9.x/'.length).split('/')[0]!;
    expect(DICEBEAR_CARTOON_STYLES).toContain(style);
  });
});

describe('applyUserCreateDefaults', () => {
  it('sets admin role and DiceBear image for the first user', () => {
    const result = applyUserCreateDefaults({ email: 'first@example.com', name: 'First', role: 'admin' }, 0, {
      style: 'personas',
      seed: 'first',
    });
    expect(result.role).toBe(AUTH_ADMIN_ROLE);
    expect(result.image).toBe('https://api.dicebear.com/9.x/personas/svg?seed=first');
  });

  it('sets user role for subsequent signups and overwrites client role', () => {
    const result = applyUserCreateDefaults({ email: 'second@example.com', name: 'Second', role: 'admin' }, 1, {
      style: 'avataaars',
      seed: 'second',
    });
    expect(result.role).toBe(AUTH_DEFAULT_ROLE);
    expect(isDiceBearAvatarUrl(result.image)).toBe(true);
  });
});
