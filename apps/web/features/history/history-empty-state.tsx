'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';

function EmptyHistoryIllustration() {
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
        <path
          d="M28 28h52a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V34a6 6 0 0 1 6-6Z"
          className="fill-paper stroke-primary/35"
          strokeWidth="2"
        />
        <path
          d="M34 40h40M34 50h32M34 60h24"
          className="stroke-muted-foreground/40"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="86" cy="28" r="14" className="fill-brand-soft/80 stroke-primary/40" strokeWidth="2" />
        <path
          d="M86 22v8M82 28h8"
          className="stroke-brand-deep/50"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path d="M80 34a10 10 0 0 0 12 0" className="stroke-brand-deep/70" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function HistoryEmptyState() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-2 py-16 text-center md:py-24">
      <EmptyHistoryIllustration />
      <h2 className="font-heading mt-10 text-2xl font-semibold tracking-tight text-foreground md:text-[2rem] md:leading-10">
        还没有阅读痕迹
      </h2>
      <p className="mt-4 max-w-sm text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
        读过的作品会安静地留在这里。先去发现一篇想读的英文吧。
      </p>
      <Button
        nativeButton={false}
        className="mt-10 h-12 rounded-full px-10 text-base hover:bg-brand-deep active:scale-[0.98]"
        render={<Link href={AUTH_ROUTES.discover} />}
      >
        发现一本书开始阅读
      </Button>
    </div>
  );
}
