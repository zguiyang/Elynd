import { usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Cookie-session Better Auth client.
 * Default baseURL is same-origin so browser hits Next `/api/auth` (rewritten to Nest).
 *
 * For typed additional fields from the server instance, use:
 * `import type { ElyndAuth } from '@elynd/auth/server'` + `inferAdditionalFields<ElyndAuth>()` in the app.
 */
export function createElyndAuthClient(options?: { baseURL?: string }) {
  return createAuthClient({
    baseURL: options?.baseURL ?? '',
    plugins: [usernameClient()],
    fetchOptions: {
      credentials: 'include',
    },
  });
}

export type ElyndAuthClient = ReturnType<typeof createElyndAuthClient>;
