import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
  className?: string;
  labelAside?: ReactNode;
};

export function Field({ label, htmlFor, error, children, className, labelAside }: FieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {labelAside}
      </div>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export const authInputClassName =
  'flex h-11 w-full rounded-lg border border-input bg-card px-3.5 text-[0.95rem] text-foreground outline-none transition-[border-color,box-shadow] duration-300 ease-out-soft placeholder:text-muted-foreground/70 focus-visible:border-primary/45 focus-visible:ring-[3px] focus-visible:ring-primary/12 disabled:opacity-50';

export const authPrimaryButtonClassName =
  'h-12 w-full rounded-full text-base duration-500 ease-out-soft hover:bg-brand-deep active:scale-[0.98]';
