import { z } from 'zod';

import { AUTH_PASSWORD_POLICY, AUTH_USERNAME_POLICY } from '../auth/policy.ts';

const passwordSchema = z.string().min(AUTH_PASSWORD_POLICY.minLength).max(AUTH_PASSWORD_POLICY.maxLength);

const usernameSchema = z
  .string()
  .min(AUTH_USERNAME_POLICY.minLength)
  .max(AUTH_USERNAME_POLICY.maxLength)
  .regex(AUTH_USERNAME_POLICY.pattern);

/** Public user JSON (wire). Dates are ISO strings. */
export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  username: z.string(),
  fullName: z.string().nullable(),
  role: z.string(),
  image: z.string().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export type User = z.infer<typeof userSchema>;

export const loginBodySchema = z.object({
  login: z.string().min(1).max(254),
  password: passwordSchema,
});

export type LoginBody = z.infer<typeof loginBodySchema>;

export const registerBodySchema = z.object({
  email: z.email(),
  username: usernameSchema,
  password: passwordSchema,
  fullName: z.string().max(100).optional(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const forgotPasswordBodySchema = z.object({
  email: z.email(),
});

export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

export const resendVerificationBodySchema = z.object({
  email: z.email(),
});

export type ResendVerificationBody = z.infer<typeof resendVerificationBodySchema>;

/** GET/POST verify — `token` from query or body (merged by Adonis validateUsing). */
export const verifyEmailBodySchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;
