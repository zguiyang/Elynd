import Link from 'next/link';

import { APP_NAME } from '@/constants';
import { cn } from '@/lib/utils';

type BrandMarkProps = {
  href?: string;
  subtitle?: string;
  size?: 'sm' | 'md';
  className?: string;
  /** Hide the wordmark; keep the icon as the brand identifier. */
  wordmark?: boolean;
};

export function BrandMark({ href = '/', subtitle, size = 'sm', className, wordmark = true }: BrandMarkProps) {
  const markClass = size === 'md' ? 'h-10 w-auto' : 'h-8 w-auto';
  const titleClass = size === 'md' ? 'text-xl' : 'text-lg';

  const content = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- local static mark; keep intrinsic ratio */}
      <img
        src="/gloaming-mark.png"
        alt=""
        width={32}
        height={27}
        className={cn(markClass, 'shrink-0')}
        decoding="async"
      />
      {wordmark ? (
        subtitle ? (
          <span className="flex flex-col">
            <span className={cn('font-semibold tracking-tight text-foreground', titleClass)}>{APP_NAME}</span>
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          </span>
        ) : (
          <span className={cn('font-semibold tracking-tight text-foreground', titleClass)}>{APP_NAME}</span>
        )
      ) : (
        <span className="sr-only">{APP_NAME}</span>
      )}
    </>
  );

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 transition-opacity duration-300 ease-out-soft hover:opacity-90',
        !wordmark && 'gap-0',
        className,
      )}
      aria-label={`${APP_NAME} home`}
    >
      {content}
    </Link>
  );
}
