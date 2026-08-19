'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { ProgressHeatmap } from '@/features/progress/progress-heatmap';
import {
  buildProgressStub,
  completionsInWindow,
  defaultCustomWindow,
  progressHeadline,
  type ProgressRangeTab,
  type ProgressWindow,
  relativeDateLabel,
  windowForTab,
} from '@/features/progress/progress-model';
import { ProgressPortraitGrid } from '@/features/progress/progress-portrait';
import { ProgressRangeTabs } from '@/features/progress/progress-range-tabs';

/**
 * Progress — look back at time with English. Example stub, not live stats.
 */
export function ProgressPage() {
  const stub = useMemo(() => buildProgressStub(), []);
  const [tab, setTab] = useState<ProgressRangeTab>('30');
  const [custom, setCustom] = useState<ProgressWindow>(() => defaultCustomWindow(stub.today));
  const selectedWindow = windowForTab(tab, stub.today, custom);
  const rows = completionsInWindow(stub.completions, selectedWindow);
  const headline = progressHeadline(selectedWindow, stub.today, rows.length);

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto w-full max-w-5xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">成长</h1>
        <p className="text-sm text-muted-foreground">示例</p>
      </header>

      <h2 className="font-heading mt-10 max-w-[36rem] text-2xl font-bold tracking-tight md:text-3xl">{headline}</h2>

      <p className="mt-4 max-w-[40rem] text-base leading-relaxed text-muted-foreground">{stub.advice}</p>

      <div className="mt-8">
        <ProgressRangeTabs
          tab={tab}
          today={stub.today}
          custom={custom}
          onTabChange={setTab}
          onCustomChange={setCustom}
        />
        <div className="mt-6">
          <ProgressHeatmap today={stub.today} activity={stub.activity} selectedWindow={selectedWindow} />
        </div>
      </div>

      <div className="mt-10 border-t border-border pt-12 md:pt-16">
        <ProgressPortraitGrid portrait={stub.portrait} />
      </div>

      <div className="mt-10 border-t border-border pt-12 md:pt-16">
        {rows.length > 0 ? (
          <ul className="max-w-2xl divide-y divide-border border-b border-border">
            {rows.map((row) => (
              <li key={`${row.date}-${row.title}`}>
                <Link
                  href={row.articleId ? AUTH_ROUTES.learnArticle(row.articleId) : AUTH_ROUTES.library}
                  className="block py-5 transition-colors duration-300 ease-out-soft hover:text-brand-deep focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <p className="font-heading text-lg font-semibold tracking-tight">{row.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{relativeDateLabel(row.date, stub.today)}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="max-w-[36rem] text-base leading-relaxed text-muted-foreground">读过的短文会记在这里。</p>
            <Button
              nativeButton={false}
              className="mt-8 h-11 rounded-xl px-7 hover:bg-brand-deep"
              render={<Link href={AUTH_ROUTES.library} />}
            >
              去图书馆
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
