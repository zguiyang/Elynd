/**
 * Pure signup defaults — no network I/O.
 * DiceBear URL is stored as a public CDN address only.
 */

export const AUTH_DEFAULT_ROLE = 'user' as const;
export const AUTH_ADMIN_ROLE = 'admin' as const;

export type AuthSignupRole = typeof AUTH_DEFAULT_ROLE | typeof AUTH_ADMIN_ROLE;

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

/** Self-serve signup never auto-promotes — bootstrap admin via seeder/ops. */
export function resolveSignupRole(_existingUserCount?: number): AuthSignupRole {
  return AUTH_DEFAULT_ROLE;
}

export function buildDiceBearAvatarUrl(options?: { style?: DiceBearCartoonStyle; seed?: string }): string {
  const style = options?.style ?? DICEBEAR_CARTOON_STYLES[Math.floor(Math.random() * DICEBEAR_CARTOON_STYLES.length)]!;
  const seed = options?.seed ?? crypto.randomUUID();
  return `https://api.dicebear.com/${DICEBEAR_API_MAJOR}/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

/**
 * Server-owned role + avatar for create payload.
 * Always overwrites role/image so client values cannot escalate.
 */
export function applyUserCreateDefaults(
  _existingUserCount?: number,
  avatarOptions?: { style?: DiceBearCartoonStyle; seed?: string },
): { role: AuthSignupRole; image: string } {
  return {
    role: resolveSignupRole(),
    image: buildDiceBearAvatarUrl(avatarOptions),
  };
}
