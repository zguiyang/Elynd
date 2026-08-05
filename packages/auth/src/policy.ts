/**
 * Side-effect-free auth validation policy (password / username).
 * Safe to import from apps/web — does not load Better Auth, env, or DB.
 */
export const AUTH_PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
} as const;

export const AUTH_USERNAME_POLICY = {
  minLength: 3,
  maxLength: 50,
  /** Letters, digits, dots, underscores — aligns with Better Auth username defaults. */
  pattern: /^[a-zA-Z0-9._]+$/,
} as const;

export function isValidUsername(username: string): boolean {
  return AUTH_USERNAME_POLICY.pattern.test(username);
}
