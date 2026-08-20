'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import type { ProgressData } from '@gloaming/shared/api/progress';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';
import { formatProgressApiError, getProgress, progressQueryKey } from '@/features/progress/progress-api';
import { ProgressHeatmap } from '@/features/progress/progress-heatmap';
import {
  activityToMap,
  completionsInWindow,
  defaultCustomWindow,
  progressAdvice,
  progressHeadline,
  type ProgressRangeTab,
  type ProgressWindow,
  relativeDateLabel,
  windowForTab,
} from '@/features/progress/progress-model';
import { ProgressPortraitGrid } from '@/features/progress/progress-portrait';
import { ProgressRangeTabs } from '@/features/progress/progress-range-tabs';

/**
 * Progress — look back at time with English.
 */
export function ProgressPage() {
  const query = useQuery({
    queryKey: progressQueryKey.snapshot,
    queryFn: ({ signal }) => getProgress({ signal }),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (query.isPending) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }

  if (query.isError || !query.data) {
    return (
      <Empty className="border border-dashed border-border bg-card/50 py-16">
        <EmptyHeader>
          <EmptyTitle>无法加载成长记录</EmptyTitle>
          <EmptyDescription>{formatProgressApiError(query.error ?? new Error('缺失'))}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <ProgressLoaded data={query.data} />;
}

function ProgressLoaded({ data }: { data: ProgressData }) {
  const [tab, setTab] = useState<ProgressRangeTab>('30');
  const [custom, setCustom] = useState<ProgressWindow>(() => defaultCustomWindow(data.today));
  const activity = activityToMap(data.activity);
  const selectedWindow = windowForTab(tab, data.today, custom);
  const rows = completionsInWindow(data.completions, selectedWindow);
  const headline = progressHeadline(selectedWindow, data.today, rows.length);

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto w-full max-w-5xl">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">成长</h1>
      </header>

      <h2 className="font-heading mt-10 max-w-[36rem] text-2xl font-bold tracking-tight md:text-3xl">{headline}</h2>

      <p className="mt-4 max-w-[40rem] text-base leading-relaxed text-muted-foreground">
        {progressAdvice(data.portrait)}
      </p>

      <div className="mt-8">
        <ProgressRangeTabs
          tab={tab}
          today={data.today}
          custom={custom}
          onTabChange={setTab}
          onCustomChange={setCustom}
        />
        <div className="mt-6">
          <ProgressHeatmap today={data.today} activity={activity} selectedWindow={selectedWindow} />
        </div>
      </div>

      <div className="mt-10 border-t border-border pt-12 md:pt-16">
        <ProgressPortraitGrid portrait={data.portrait} />
      </div>

      <div className="mt-10 border-t border-border pt-12 md:pt-16">
        {rows.length > 0 ? (
          <ul className="max-w-2xl divide-y divide-border border-b border-border">
            {rows.map((row) => (
              <li key={`${row.date}-${row.articleId}`}>
                <Link
                  href={AUTH_ROUTES.learnArticle(row.articleId)}
                  className="block py-5 transition-colors duration-300 ease-out-soft hover:text-brand-deep focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <p className="font-heading text-lg font-semibold tracking-tight">{row.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{relativeDateLabel(row.date, data.today)}</p>
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
