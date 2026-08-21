'use client';

import type { LearnTodayEntry } from '@gloaming/shared/api/learn';

import { ShelfBookCard } from '@/features/shelf/shelf-book-card';

export function ShelfGrid({ items }: { items: LearnTodayEntry[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="w-full">
      <div className="mb-6 flex items-center border-b border-border/40 pb-4 md:mb-8">
        <h3 className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">我的藏书</h3>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4 md:gap-x-8 md:gap-y-12 lg:grid-cols-5">
        {items.map((entry) => (
          <ShelfBookCard key={entry.article.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}
