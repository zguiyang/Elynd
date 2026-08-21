'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';

function EmptyDiscoverIllustration() {
  return (
    <div
      className="flex size-40 items-center justify-center rounded-full bg-muted ring-1 ring-border/40 md:size-52"
      aria-hidden
    >
      <svg
        viewBox="0 0 120 96"
        className="h-20 w-24 text-primary/80 md:h-24 md:w-28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="22" y="18" width="52" height="68" rx="4" className="fill-paper stroke-primary/35" strokeWidth="2" />
        <rect x="46" y="12" width="52" height="68" rx="4" className="fill-card stroke-primary/35" strokeWidth="2" />
        <circle cx="88" cy="70" r="18" className="fill-brand-soft/80 stroke-primary/40" strokeWidth="2" />
        <path d="M88 62v16M80 70h16" className="stroke-brand-deep/70" strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M32 34h28M32 44h22M32 54h26"
          className="stroke-muted-foreground/35"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

type DiscoverEmptyStateProps = {
  onResetFilters?: () => void;
};

export function DiscoverEmptyState({ onResetFilters }: DiscoverEmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-2 py-16 text-center md:py-24">
      <EmptyDiscoverIllustration />
      <h2 className="font-heading mt-10 text-2xl font-semibold tracking-tight text-foreground md:text-[2rem] md:leading-10">
        暂时没有可发现的内容
      </h2>
      <p className="mt-4 max-w-sm text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
        换个分类看看，或稍后再来。官方书目会慢慢充实。
      </p>
      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
        {onResetFilters ? (
          <Button
            type="button"
            className="h-12 rounded-full px-8 text-base hover:bg-brand-deep active:scale-[0.98]"
            onClick={onResetFilters}
          >
            查看全部推荐
          </Button>
        ) : null}
        <Button
          nativeButton={false}
          variant="outline"
          className="h-12 rounded-full px-8 text-base"
          render={<Link href={AUTH_ROUTES.shelf} />}
        >
          回到我的书架
        </Button>
      </div>
    </div>
  );
}
