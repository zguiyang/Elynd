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
      <div className="container py-24 md:py-32">{children}</div>
    </section>
  );
}
