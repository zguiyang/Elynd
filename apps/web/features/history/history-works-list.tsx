'use client';

import { HistoryBookCard } from '@/features/history/history-book-card';
import type { HistoryWork } from '@/features/history/history-mock';

type HistoryWorksListProps = {
  works: HistoryWork[];
};

export function HistoryWorksList({ works }: HistoryWorksListProps) {
  if (works.length === 0) {
    return null;
  }

  const completed = works.filter((w) => w.status === 'completed');
  const inProgress = works.filter((w) => w.status === 'in_progress');

  return (
    <div className="mx-auto flex w-full max-w-reading-column flex-col gap-10">
      {inProgress.length > 0 ? (
        <section>
          <h2 className="font-heading hidden text-2xl font-semibold text-foreground md:block">进行中</h2>
          <h2 className="border-b border-border/50 pb-2 text-sm font-medium tracking-wider text-muted-foreground uppercase md:hidden">
            进行中
          </h2>
          <div className="mt-2 flex flex-col md:mt-4">
            {inProgress.map((work) => (
              <HistoryBookCard key={work.id} work={work} />
            ))}
          </div>
        </section>
      ) : null}

      {completed.length > 0 ? (
        <section>
          <h2 className="font-heading hidden text-2xl font-semibold text-foreground md:block">读过的作品</h2>
          <h2 className="border-b border-border/50 pb-2 text-sm font-medium tracking-wider text-muted-foreground uppercase md:hidden">
            已读完作品
          </h2>
          <div className="mt-2 flex flex-col md:mt-4">
            {completed.map((work) => (
              <HistoryBookCard key={work.id} work={work} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
