import type { BetterAuthOptions } from 'better-auth';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, username } from 'better-auth/plugins';

import { accounts, sessions, setupDb, users, verifications } from '@elynd/db';

import { authEnvSchema, parseTrustedOrigins } from '../config/auth-env.schema.js';
import { AUTH_SESSION_CONFIG } from './auth-session.config.js';

type AuthInstance = ReturnType<typeof betterAuth>;

let authInstanceCache: AuthInstance | null = null;

export function getAuthInstance(): AuthInstance {
  if (authInstanceCache) {
    return authInstanceCache;
  }

  const authEnv = authEnvSchema.parse(process.env);
  const db = setupDb(authEnv.DATABASE_URI);

  const config: BetterAuthOptions = {
    plugins: [
      bearer(),
      username({
        maxUsernameLength: 50,
      }),
    ],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        users,
        sessions,
        accounts,
        verifications,
      },
    }),
    secret: authEnv.AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
    },
    user: {
      modelName: 'users',
    },
    account: {
      modelName: 'accounts',
    },
    verification: {
      modelName: 'verifications',
    },
    session: {
      modelName: 'sessions',
      expiresIn: AUTH_SESSION_CONFIG.expiresIn,
      updateAge: AUTH_SESSION_CONFIG.updateAge,
    },
    baseURL: authEnv.BETTER_AUTH_URL,
    trustedOrigins: parseTrustedOrigins(authEnv.BETTER_AUTH_TRUSTED_ORIGINS),
    advanced: {
      cookiePrefix: 'elynd-auth',
    },
  };

  authInstanceCache = betterAuth(config);
  return authInstanceCache;
}
