'use client';

import { ChevronsLeftIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { AUTH_ROUTES } from '@/constants';
import { BookDetailCover } from '@/features/book-detail/book-detail-cover';
import { coverUrlFromAssetId } from '@/features/book-detail/book-detail-model';
import { chapterStatusForPart, type ReaderViewModel, sortedParts } from '@/features/reader/reader-model';
import { cn } from '@/lib/utils';

type ReaderTocSidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reader: ReaderViewModel;
  currentPartId: string;
  onSelectChapter: (partId: string) => void;
};

function useIsDesktopTocLayout() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia('(min-width: 768px)');
      media.addEventListener('change', onStoreChange);
      return () => media.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia('(min-width: 768px)').matches,
    () => true,
  );
}

export function ReaderTocSidebar({
  open,
  onOpenChange,
  reader,
  currentPartId,
  onSelectChapter,
}: ReaderTocSidebarProps) {
  const isDesktop = useIsDesktopTocLayout();
  const parts = sortedParts(reader.parts);
  const detailHref = AUTH_ROUTES.bookDetail(reader.workId);
  const coverImageUrl = coverUrlFromAssetId(reader.coverAssetId);

  const list = (
    <div className="flex h-full flex-col bg-surface-container-low">
      <div className="relative border-b border-border/40 p-6 pb-5">
        <button
          type="button"
          className="absolute top-4 right-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-surface-container-high hover:text-foreground"
          aria-label="收起目录"
          onClick={() => onOpenChange(false)}
        >
          <ChevronsLeftIcon className="size-5" strokeWidth={1.5} />
        </button>
        <div className="mt-2 flex gap-4">
          <BookDetailCover
            title={reader.workTitle}
            tags={reader.tags}
            coverImageUrl={coverImageUrl}
            className="aspect-[2/3] w-16 shrink-0 rounded-sm shadow-sm"
          />
          <div className="flex min-w-0 flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">目录</p>
            <h2 className="font-heading text-lg leading-snug font-semibold text-primary">{reader.workTitle}</h2>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5 pr-2">
          {parts.map((part, index) => (
            <TocRow
              key={part.id}
              index={index + 1}
              title={part.title || `第 ${index + 1} 章`}
              status={chapterStatusForPart(part, reader.state, currentPartId)}
              onClick={() => {
                onSelectChapter(part.id);
                onOpenChange(false);
              }}
            />
          ))}
        </ul>
      </nav>

      <div className="border-t border-border/40 p-4">
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          查看书籍详情
          <ExternalLinkIcon className="size-3.5" strokeWidth={1.5} aria-hidden />
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden w-80 border-r border-border/40 transition-transform duration-300 ease-out-soft md:block',
          open ? 'translate-x-0' : '-translate-x-full pointer-events-none',
        )}
        aria-hidden={!open}
      >
        {list}
      </aside>

      <Sheet open={open && !isDesktop} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[min(20rem,100vw)] gap-0 border-r p-0 md:hidden" showCloseButton={false}>
          <SheetTitle className="sr-only">目录</SheetTitle>
          {list}
        </SheetContent>
      </Sheet>
    </>
  );
}

function TocRow({
  index,
  title,
  status,
  onClick,
}: {
  index: number;
  title: string;
  status: 'read' | 'current' | 'unread';
  onClick: () => void;
}) {
  const isCurrent = status === 'current';
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-3 px-6 py-3 text-left text-sm transition-colors',
          isCurrent
            ? 'border-l-4 border-primary bg-secondary/60 font-medium text-foreground'
            : 'border-l-4 border-transparent text-muted-foreground hover:bg-surface-container-high/80 hover:text-foreground',
        )}
      >
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{index}</span>
        <span className="truncate">{title}</span>
      </button>
    </li>
  );
}
