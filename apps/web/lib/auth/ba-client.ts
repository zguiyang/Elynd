'use client';

import { usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Official Better Auth React client — talks to Hono via same-origin `/api/auth/*` rewrite.
 * Web never hosts the auth server.
 */
export const baClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [usernameClient()],
});
