'use client'

import { useForm } from '@tanstack/react-form'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { AUTH_ROUTES } from '@/constants'
import { AuthShell, Field, inputClassName } from '@/features/auth/auth-shell'
import { authClient, extractSessionToken, setAuthToken } from '@/lib/auth'
import { signInSchema } from '@/lib/validations'

export function SignInForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      email: '',
      password: ''
    },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const parsed = signInSchema.safeParse(value)
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Invalid input')
        return
      }

      const { data, error } = await authClient.signIn.email({
        email: parsed.data.email,
        password: parsed.data.password
      })

      if (error) {
        const message = error.message || 'Sign in failed'
        setFormError(message)
        toast.error(message)
        return
      }

      const token = extractSessionToken(data)
      if (!token) {
        const message = 'Sign in succeeded but no session token was returned'
        setFormError(message)
        toast.error(message)
        return
      }

      setAuthToken(token)
      toast.success('Signed in')
      router.replace(AUTH_ROUTES.dashboard)
    }
  })

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your email and password"
      footer={
        <>
          No account?{' '}
          <Link href={AUTH_ROUTES.signUp} className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="email">
          {(field) => (
            <Field label="Email" htmlFor="sign-in-email">
              <input
                id="sign-in-email"
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
            <Field label="Password" htmlFor="sign-in-password">
              <input
                id="sign-in-password"
                type="password"
                autoComplete="current-password"
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
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthShell>
  )
}
