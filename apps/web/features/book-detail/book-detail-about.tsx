import type { BookDetail } from '@/features/book-detail/book-detail-model';

export function BookDetailAbout({ book }: { book: BookDetail }) {
  if (!book.sourceNote.trim()) {
    return null;
  }

  return (
    <section className="mx-auto max-w-reading-column space-y-5 border-t border-border/50 pt-8 md:border-0 md:pt-0 md:space-y-6">
      <h2 className="font-heading text-left text-xl font-semibold text-foreground md:text-center md:text-2xl">
        来源说明
      </h2>
      <p className="font-reading text-base leading-7 text-muted-foreground md:text-xl md:leading-9">
        {book.sourceNote}
      </p>
      <p className="text-sm text-muted-foreground/80">来源：{book.sourceLabel}</p>
    </section>
  );
}
