import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9._]+$/, 'Username may only contain letters, numbers, dots, and underscores'),
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
