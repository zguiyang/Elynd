import type { BookDetail } from '@/features/book-detail/book-detail-model';

export function BookDetailStats({ book }: { book: BookDetail }) {
  const tagLine = book.tags.slice(0, 3).join(' · ') || '—';
  const published = book.publishedAt
    ? new Date(book.publishedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <section className="border-y border-border/50 py-6 md:py-8">
      <h2 className="font-heading mb-4 text-xl font-semibold text-foreground md:hidden">阅读信息</h2>
      <div className="mx-auto grid max-w-reading-column grid-cols-2 divide-x divide-border/50 text-center md:grid-cols-3">
        <div className="px-2 md:px-4">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">标签</p>
          <p className="mt-1 text-sm font-medium text-foreground">{tagLine}</p>
        </div>
        <div className="px-2 md:px-4">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">来源</p>
          <p className="mt-1 text-sm font-medium text-foreground">{book.sourceLabel}</p>
        </div>
        <div className="col-span-2 px-2 md:col-span-1 md:px-4">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">上架</p>
          <p className="mt-1 text-sm font-medium text-foreground">{published}</p>
        </div>
      </div>
    </section>
  );
}
