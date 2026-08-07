/** Opaque access token — tab-scoped (cleared when the tab closes). */
export const ACCESS_TOKEN_STORAGE_KEY = 'elynd.access_token' as const;

/**
 * Non-secret presence cookie for Next proxy optimistic redirects.
 * The real bearer token stays in sessionStorage.
 */
export const AUTH_HINT_COOKIE = 'elynd_auth_hint' as const;

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  document.cookie = `${AUTH_HINT_COOKIE}=1; path=/; SameSite=Lax`;
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  document.cookie = `${AUTH_HINT_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
}

export function hasAccessToken(): boolean {
  return Boolean(getAccessToken());
}
