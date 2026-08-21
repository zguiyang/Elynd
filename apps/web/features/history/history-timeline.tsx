'use client';

import { formatHistoryEventWhen, type HistoryEvent } from '@/features/history/history-mock';
import { cn } from '@/lib/utils';

export function HistoryTimeline({ events }: { events: HistoryEvent[] }) {
  if (events.length === 0) {
    return null;
  }

  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <section className="space-y-4 md:hidden">
      <h2 className="border-b border-border/50 pb-2 text-sm font-medium tracking-wider text-muted-foreground uppercase">
        近期动态
      </h2>
      <ul className="flex flex-col gap-6 py-1">
        {sorted.map((event, index) => (
          <li key={event.id} className="flex items-start gap-4">
            <span
              className={cn('mt-1.5 size-2 shrink-0 rounded-full', index === 0 ? 'bg-primary' : 'bg-border')}
              aria-hidden
            />
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {formatHistoryEventWhen(event.at)}
              </p>
              <p className="mt-0.5 text-base text-foreground">
                {event.kind === 'completed' && event.title ? (
                  <>
                    读完了 <span className="italic">{event.title}</span>
                  </>
                ) : null}
                {event.kind === 'resumed' && event.title ? (
                  <>
                    继续读了 <span className="italic">{event.title}</span>
                  </>
                ) : null}
                {event.kind === 'lookup' && event.lookupCount != null ? `查询了 ${event.lookupCount} 个生词` : null}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
