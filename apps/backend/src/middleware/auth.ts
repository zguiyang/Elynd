import { createMiddleware } from 'hono/factory';

import { auth, type AuthSession, type AuthSessionUser } from '@/lib/auth';

export type AuthVariables = {
  user: AuthSessionUser | null;
  session: AuthSession | null;
};

/** Hydrate BA session onto context (null when anonymous). */
export const sessionMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set('user', result?.user ?? null);
  c.set('session', result?.session ?? null);
  await next();
});

/** Require a valid Better Auth session — 401 when missing. */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const user = c.get('user');
  const session = c.get('session');
  if (!user || !session) {
    return c.json({ message: 'Unauthorized' }, 401);
  }
  await next();
});
