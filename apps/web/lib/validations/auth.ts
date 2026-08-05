import { z } from 'zod';

import { AUTH_PASSWORD_POLICY, AUTH_USERNAME_POLICY } from '@elynd/auth/policy';

const passwordSchema = z
  .string()
  .min(AUTH_PASSWORD_POLICY.minLength, `Password must be at least ${AUTH_PASSWORD_POLICY.minLength} characters`)
  .max(AUTH_PASSWORD_POLICY.maxLength, `Password must be at most ${AUTH_PASSWORD_POLICY.maxLength} characters`);

export const signInSchema = z.object({
  email: z.email('Enter a valid email'),
  password: passwordSchema,
});

export const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  username: z
    .string()
    .min(AUTH_USERNAME_POLICY.minLength, `Username must be at least ${AUTH_USERNAME_POLICY.minLength} characters`)
    .max(AUTH_USERNAME_POLICY.maxLength, `Username must be at most ${AUTH_USERNAME_POLICY.maxLength} characters`)
    .regex(AUTH_USERNAME_POLICY.pattern, 'Username may only contain letters, numbers, dots, and underscores'),
  email: z.email('Enter a valid email'),
  password: passwordSchema,
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
