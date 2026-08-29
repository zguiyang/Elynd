import type { BookDetail } from '@/features/book-detail/book-detail-model';

export function BookDetailAbout({ book }: { book: BookDetail }) {
  if (book.about.length === 0) {
    return null;
  }

  const footnoteParts = [
    `来源：${book.sourceLabel}`,
    book.sourceNote.trim() || null,
    book.languageLabel || null,
  ].filter(Boolean);

  return (
    <section className="mx-auto max-w-reading-column space-y-5 border-t border-border/50 pt-8 md:border-0 md:pt-0 md:space-y-6">
      <h2 className="font-heading text-left text-xl font-semibold text-foreground md:text-center md:text-2xl">简介</h2>
      <div className="font-reading space-y-5 text-base leading-7 text-muted-foreground md:text-xl md:leading-9">
        {book.about.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
        ))}
      </div>
      <p className="text-sm text-muted-foreground/80">{footnoteParts.join(' · ')}</p>
    </section>
  );
}
