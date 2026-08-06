import { BookOpen } from 'lucide-react';
import Link from 'next/link';

import { APP_NAME } from '@/constants';
import { cn } from '@/lib/utils';

type BrandMarkProps = {
  href?: string;
  subtitle?: string;
  size?: 'sm' | 'md';
  className?: string;
};

export function BrandMark({ href = '/', subtitle, size = 'sm', className }: BrandMarkProps) {
  const iconBox = size === 'md' ? 'size-11 rounded-2xl' : 'size-9 rounded-xl';
  const iconSize = size === 'md' ? 'size-5' : 'size-[18px]';
  const titleClass = size === 'md' ? 'text-xl' : 'text-lg';

  const content = (
    <>
      <span className={cn('flex items-center justify-center bg-brand-soft ring-1 ring-primary/10', iconBox)}>
        <BookOpen className={cn(iconSize, 'text-primary')} strokeWidth={1.5} aria-hidden />
      </span>
      {subtitle ? (
        <span className="flex flex-col">
          <span className={cn('font-semibold tracking-tight text-foreground', titleClass)}>{APP_NAME}</span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </span>
      ) : (
        <span className={cn('font-semibold tracking-tight text-foreground', titleClass)}>{APP_NAME}</span>
      )}
    </>
  );

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 transition-opacity duration-300 ease-out-soft hover:opacity-90',
        className,
      )}
      aria-label={`${APP_NAME} home`}
    >
      {content}
    </Link>
  );
}
