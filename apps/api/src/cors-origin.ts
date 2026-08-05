/**
 * Maps a trusted-origin allowlist to Nest `enableCors({ origin })`.
 * Empty list → `false` so CORS never reflects an arbitrary request origin.
 */
export function resolveCorsOrigin(trustedOrigins: string[]): false | string[] {
  if (trustedOrigins.length === 0) {
    return false;
  }
  return trustedOrigins;
}
