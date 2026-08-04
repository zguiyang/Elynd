import type { ReactNode } from 'react'
import Link from 'next/link'

import { APP_NAME } from '@/constants'
import { cn } from '@/lib/utils'

type AuthShellProps = {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <Link
            href="/"
            className="text-sm font-medium tracking-wide text-muted-foreground hover:text-foreground"
          >
            {APP_NAME}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
      </div>
    </main>
  )
}

type FieldProps = {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, error, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export const inputClassName =
  'flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'
