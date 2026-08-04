import { createElyndAuthClient } from '@elynd/auth/client';

/**
 * Cookie-session Better Auth client.
 * Same-origin baseURL so requests hit Next `/api/auth` (rewritten to Nest).
 */
export const authClient = createElyndAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? '',
});
