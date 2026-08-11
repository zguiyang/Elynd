import { AUTH_PASSWORD_POLICY } from '@elynd/shared/auth/policy';
import * as schema from '@elynd/db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { Resend } from 'resend';

import { db } from '@/db';
import { env } from '@/lib/env';
import { authLogger } from '@/lib/logger';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

async function sendMail(input: { to: string; subject: string; text: string }): Promise<void> {
  if (!resend) {
    authLogger.warn({ to: input.to, subject: input.subject }, 'RESEND_API_KEY unset; email not sent');
    return;
  }

  const { error } = await resend.emails.send({
    from: `${env.MAIL_FROM_NAME} <${env.MAIL_FROM_ADDRESS}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  if (error) {
    authLogger.error({ error }, 'Failed to send email via Resend');
    throw new Error(error.message);
  }
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.FRONTEND_URL],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: AUTH_PASSWORD_POLICY.minLength,
    maxPasswordLength: AUTH_PASSWORD_POLICY.maxLength,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      void sendMail({
        to: user.email,
        subject: 'Reset your Elynd password',
        text: `Reset your password: ${url}`,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void sendMail({
        to: user.email,
        subject: 'Verify your Elynd email',
        text: `Verify your email: ${url}`,
      });
    },
  },
});

export type Auth = typeof auth;
