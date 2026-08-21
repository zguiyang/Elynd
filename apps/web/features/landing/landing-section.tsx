import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function LandingSection({
  id,
  children,
  className,
  tone = 'canvas',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: 'canvas' | 'paper' | 'card';
}) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-20',
        tone === 'paper' && 'border-y border-border/60 bg-surface-container',
        tone === 'card' && 'border-y border-border/60 bg-card',
        tone === 'canvas' && 'bg-background',
        className,
      )}
    >
      <div className="mx-auto max-w-container-max px-6 py-24 md:px-10 md:py-32">{children}</div>
    </section>
  );
}
