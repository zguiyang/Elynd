/**
 * Pure signup defaults for Better Auth `databaseHooks.user.create.before`.
 * No network I/O — DiceBear URL is stored as a public CDN address only.
 */

export const AUTH_DEFAULT_ROLE = 'user' as const;
export const AUTH_ADMIN_ROLE = 'admin' as const;

export type AuthSignupRole = typeof AUTH_DEFAULT_ROLE | typeof AUTH_ADMIN_ROLE;

/** Approved cartoon styles for DiceBear 9.x public API. */
export const DICEBEAR_CARTOON_STYLES = [
  'lorelei',
  'adventurer',
  'big-smile',
  'croodles',
  'personas',
  'avataaars',
] as const;

export type DiceBearCartoonStyle = (typeof DICEBEAR_CARTOON_STYLES)[number];

const DICEBEAR_API_MAJOR = '9.x';

export function resolveSignupRole(existingUserCount: number): AuthSignupRole {
  return existingUserCount === 0 ? AUTH_ADMIN_ROLE : AUTH_DEFAULT_ROLE;
}

export function buildDiceBearAvatarUrl(options?: { style?: DiceBearCartoonStyle; seed?: string }): string {
  const style = options?.style ?? DICEBEAR_CARTOON_STYLES[Math.floor(Math.random() * DICEBEAR_CARTOON_STYLES.length)]!;
  const seed = options?.seed ?? crypto.randomUUID();
  return `https://api.dicebear.com/${DICEBEAR_API_MAJOR}/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

const DICEBEAR_URL_PATTERN = /^https:\/\/api\.dicebear\.com\/9\.x\/[a-z0-9-]+\/svg\?seed=.+$/;

export function isDiceBearAvatarUrl(url: string): boolean {
  if (!DICEBEAR_URL_PATTERN.test(url)) {
    return false;
  }
  const style = url.slice('https://api.dicebear.com/9.x/'.length).split('/')[0];
  return (DICEBEAR_CARTOON_STYLES as readonly string[]).includes(style ?? '');
}

/**
 * Merge server-owned role + avatar onto the create payload.
 * Always overwrites `role` / `image` so client-supplied values cannot escalate.
 */
export function applyUserCreateDefaults<T extends Record<string, unknown>>(
  user: T,
  existingUserCount: number,
  avatarOptions?: { style?: DiceBearCartoonStyle; seed?: string },
): T & { role: AuthSignupRole; image: string } {
  return {
    ...user,
    role: resolveSignupRole(existingUserCount),
    image: buildDiceBearAvatarUrl(avatarOptions),
  };
}
