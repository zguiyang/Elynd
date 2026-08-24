'use client';

import Link from 'next/link';

import { AUTH_ROUTES } from '@/constants';
import type { HistoryViewModel } from '@/features/history/history-model';

export function HistoryCompletions({ completions }: { completions: HistoryViewModel['completions'] }) {
  if (completions.length === 0) {
    return null;
  }

  const sorted = [...completions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="mx-auto w-full max-w-reading-column space-y-4">
      <h2 className="font-heading text-xl font-semibold text-foreground md:text-2xl">读完的文章</h2>
      <ul className="divide-y divide-border/50 rounded-2xl border border-border/40 bg-paper">
        {sorted.map((item) => (
          <li key={`${item.articleId}-${item.date}`}>
            <Link
              href={AUTH_ROUTES.readBook(item.articleId)}
              className="flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-surface-container-low md:flex-row md:items-center md:justify-between"
            >
              <span className="font-heading text-base font-medium text-foreground">{item.title}</span>
              <span className="text-sm text-muted-foreground">{item.date}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
