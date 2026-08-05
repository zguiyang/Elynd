import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { openAPI, username } from 'better-auth/plugins';

import { accounts, sessions, setupDb, users, verifications } from '@elynd/db';

import { authEnvSchema, parseTrustedOrigins } from './env.js';
import { AUTH_PASSWORD_POLICY, AUTH_USERNAME_POLICY, isValidUsername } from './policy.js';
import { AUTH_SESSION_CONFIG } from './session.config.js';

/**
 * Eager Better Auth instance. Callers (apps/api) MUST load process.env
 * before importing this module (see apps/api/src/load-env.ts).
 *
 * Pass options inline to `betterAuth(...)` (do not widen to BetterAuthOptions)
 * so plugin fields (e.g. username) remain on `$Infer`.
 */
const authEnv = authEnvSchema.parse(process.env);
const db = setupDb(authEnv.DATABASE_URI);

export const auth = betterAuth({
  plugins: [
    username({
      minUsernameLength: AUTH_USERNAME_POLICY.minLength,
      maxUsernameLength: AUTH_USERNAME_POLICY.maxLength,
      usernameValidator: isValidUsername,
    }),
    // Schema only for Apifox / openapi:gen — disable Scalar UI (docs live in Apifox).
    openAPI({
      disableDefaultReference: true,
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
    minPasswordLength: AUTH_PASSWORD_POLICY.minLength,
    maxPasswordLength: AUTH_PASSWORD_POLICY.maxLength,
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
  // Public browser origin (Next). Cookies are set via same-origin /api proxy.
  baseURL: authEnv.BETTER_AUTH_URL,
  basePath: '/api/auth',
  trustedOrigins: parseTrustedOrigins(authEnv.BETTER_AUTH_TRUSTED_ORIGINS),
  advanced: {
    cookiePrefix: 'elynd-auth',
  },
});

export type ElyndAuth = typeof auth;
export type AuthSession = ElyndAuth['$Infer']['Session'];
export type AuthUser = AuthSession['user'];

export type { AuthEnvConfig } from './env.js';
export { authEnvSchema, parseTrustedOrigins } from './env.js';
export { AUTH_PASSWORD_POLICY, AUTH_USERNAME_POLICY, isValidUsername } from './policy.js';
export { AUTH_SESSION_CONFIG } from './session.config.js';
