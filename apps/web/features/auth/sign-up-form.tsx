'use client';

import { useForm } from '@tanstack/react-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { AuthShell, Field, inputClassName } from '@/features/auth/auth-shell';
import { authClient } from '@/lib/auth';
import { signUpSchema } from '@/lib/validations';

export function SignUpForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const parsed = signUpSchema.safeParse(value);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Invalid input');
        return;
      }

      const { data, error } = await authClient.signUp.email({
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.name,
        username: parsed.data.username,
      });

      if (error) {
        const message = error.message || 'Sign up failed';
        setFormError(message);
        toast.error(message);
        return;
      }

      if (!data) {
        toast.success('Account created. Please sign in.');
        router.replace(AUTH_ROUTES.signIn);
        return;
      }

      toast.success('Account created');
      router.replace(AUTH_ROUTES.dashboard);
    },
  });

  return (
    <AuthShell
      title="Create account"
      subtitle="Email, username, and display name"
      footer={
        <>
          Already have an account?{' '}
          <Link href={AUTH_ROUTES.signIn} className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <Field label="Name" htmlFor="sign-up-name">
              <input
                id="sign-up-name"
                type="text"
                autoComplete="name"
                className={inputClassName}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="username">
          {(field) => (
            <Field label="Username" htmlFor="sign-up-username">
              <input
                id="sign-up-username"
                type="text"
                autoComplete="username"
                className={inputClassName}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <Field label="Email" htmlFor="sign-up-email">
              <input
                id="sign-up-email"
                type="email"
                autoComplete="email"
                className={inputClassName}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <Field label="Password" htmlFor="sign-up-password">
              <input
                id="sign-up-password"
                type="password"
                autoComplete="new-password"
                className={inputClassName}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create account'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthShell>
  );
}
