'use client';

import { useSearchParams } from 'next/navigation';

import { ShelfContinueHero } from '@/features/shelf/shelf-continue-hero';
import { ShelfEmptyState } from '@/features/shelf/shelf-empty-state';
import { ShelfGrid } from '@/features/shelf/shelf-grid';
import { SHELF_MOCK_EMPTY, SHELF_MOCK_POPULATED } from '@/features/shelf/shelf-mock';
import { cn } from '@/lib/utils';

function ShelfHeader({ hasResumeHint }: { hasResumeHint: boolean }) {
  return (
    <header className="mb-10 w-full text-left md:mx-auto md:mb-14 md:max-w-xl md:text-center">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-5xl md:leading-[1.15]">
        我的书架
      </h1>
      {hasResumeHint ? (
        <p className="mt-3 text-base text-muted-foreground md:mt-4 md:text-xl md:leading-8">
          回来，继续读你喜欢的英文。
        </p>
      ) : null}
    </header>
  );
}

/**
 * Shelf UI prototype: local mock data only (no learn/shelf API).
 * Append `?empty=1` to preview the empty state.
 */
export function ShelfPage() {
  const searchParams = useSearchParams();
  const isEmptyPreview = searchParams.get('empty') === '1';
  const data = isEmptyPreview ? SHELF_MOCK_EMPTY : SHELF_MOCK_POPULATED;
  const current = data.current;
  const items = data.items;
  const isEmpty = !current && items.length === 0;

  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700',
        'mx-auto flex w-full max-w-5xl flex-col',
        isEmpty ? 'min-h-[70dvh] justify-center' : '',
      )}
    >
      {!isEmptyPreview ? (
        <p className="mb-4 text-center text-xs text-muted-foreground md:mb-6">
          界面预览（假数据）· 加 ?empty=1 看空书架
        </p>
      ) : null}
      {isEmpty ? (
        <>
          <ShelfHeader hasResumeHint={false} />
          <ShelfEmptyState />
        </>
      ) : (
        <>
          <ShelfHeader hasResumeHint />
          <div className="flex flex-col gap-14 md:gap-20">
            {current ? <ShelfContinueHero entry={current} /> : null}
            <ShelfGrid items={items} />
          </div>
        </>
      )}
    </div>
  );
}
