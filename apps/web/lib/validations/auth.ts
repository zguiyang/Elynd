import { z } from 'zod';

import {
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from '@elynd/shared/api/auth';

/** Sign-in form = product login body (`login` may be email or username). */
export const signInSchema = loginBodySchema;

export type SignInValues = z.infer<typeof signInSchema>;

/** Sign-up form aligns with BA `name` + username plugin fields. */
export const signUpSchema = registerBodySchema;

export type SignUpValues = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = forgotPasswordBodySchema;

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/** Reset form: password (+ confirm). Token comes from the URL, not the form schema. */
export const resetPasswordSchema = resetPasswordBodySchema
  .pick({ password: true })
  .extend({
    passwordConfirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
