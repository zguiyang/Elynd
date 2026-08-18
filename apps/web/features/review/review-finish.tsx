import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { finishCopy, type ReviewFinishVariant, type ReviewMiss } from '@/features/review/review-model';

type ReviewFinishProps = {
  variant: ReviewFinishVariant;
  articleTitle: string;
  sourceHref: string;
  misses: ReviewMiss[];
  total: number;
};

/**
 * Empty / done / early-exit / same-day cap — same manuscript, different copy.
 */
export function ReviewFinish({ variant, articleTitle, sourceHref, misses, total }: ReviewFinishProps) {
  if (variant === 'empty') {
    return (
      <>
        <p className="mt-16 max-w-[36rem] text-xl leading-relaxed text-foreground">今天没有要再碰的。</p>
        <div className="mt-10">
          <Button
            nativeButton={false}
            className="h-11 rounded-xl px-7 hover:bg-brand-deep"
            render={<Link href={AUTH_ROUTES.library} />}
          >
            去图书馆
          </Button>
        </div>
      </>
    );
  }

  const copy = finishCopy({
    variant,
    missCount: misses.length,
    total,
  });
  const hasMissList = variant !== 'capped' && misses.length > 0;
  const shouldShowOriginal = hasMissList;
  const shouldShowLibrary = variant === 'capped' || (variant !== 'early' && misses.length === 0);

  return (
    <>
      <p className="mt-10 text-base leading-relaxed text-muted-foreground">
        来自 <span className="font-heading font-semibold tracking-tight text-foreground">{articleTitle}</span>
      </p>
      <div className="mt-6 border-t border-border pt-12">
        <h2 className="font-heading max-w-[36rem] text-3xl font-bold tracking-tight md:text-4xl">{copy.title}</h2>
        {copy.sub ? (
          <p className="mt-4 max-w-[36rem] text-base leading-relaxed text-muted-foreground">{copy.sub}</p>
        ) : null}
      </div>

      {hasMissList ? (
        <ul className="mt-10 divide-y divide-border border-t border-border">
          {misses.map((miss) => (
            <li key={miss.item.id} className="py-6">
              <p className="max-w-[40rem] text-lg leading-relaxed">{miss.item.sentence}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{miss.item.hintZh}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-10 flex flex-wrap items-center gap-6">
        <Button
          nativeButton={false}
          className="h-11 rounded-xl px-7 hover:bg-brand-deep"
          render={<Link href={AUTH_ROUTES.dashboard} />}
        >
          回今日
        </Button>
        {shouldShowOriginal ? (
          <Button
            nativeButton={false}
            variant="ghost"
            className="h-11 rounded-xl px-3 text-muted-foreground hover:text-foreground"
            render={<Link href={sourceHref} />}
          >
            打开原文
          </Button>
        ) : null}
        {shouldShowLibrary ? (
          <Button
            nativeButton={false}
            variant="ghost"
            className="h-11 rounded-xl px-3 text-muted-foreground hover:text-foreground"
            render={<Link href={AUTH_ROUTES.library} />}
          >
            去图书馆
          </Button>
        ) : null}
      </div>
    </>
  );
}
