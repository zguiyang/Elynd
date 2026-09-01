'use client';

import { BookMarkedIcon, CompassIcon, HistoryIcon, MoreHorizontalIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';

import {
  getPrimaryNavLink,
  matchesNavPath,
  MOBILE_PRIMARY_TAB_IDS,
  NAV_COPY,
  type PrimaryNavId,
} from '@/components/navigation/nav-config';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const TAB_ICONS: Record<PrimaryNavId, ReactNode> = {
  shelf: <BookMarkedIcon className="size-5" strokeWidth={1.5} aria-hidden />,
  discover: <CompassIcon className="size-5" strokeWidth={1.5} aria-hidden />,
  history: <HistoryIcon className="size-5" strokeWidth={1.5} aria-hidden />,
};

function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="border-b border-border/80 px-5 py-4 text-left">
          <SheetTitle>{NAV_COPY.moreSheetTitle}</SheetTitle>
          <SheetDescription>{NAV_COPY.moreSheetDescription}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-3 py-4">
          <MorePlaceholderRow label={NAV_COPY.morePlaceholderAccount} />
          <p className="px-2.5 text-xs leading-5 text-muted-foreground">{NAV_COPY.moreFutureHint}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MorePlaceholderRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl px-2.5 py-3 text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="text-xs tracking-wide">{NAV_COPY.morePlaceholderHint}</span>
    </div>
  );
}

/**
 * Learner mobile bottom tabs. AppShell only — never on Reader / Admin / Landing.
 */
export function MobileBottomNav() {
  const pathname = usePathname() ?? '/';
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <>
      <nav
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md md:hidden',
          'pb-[env(safe-area-inset-bottom)]',
        )}
        aria-label="主导航"
      >
        <div className="mx-auto grid h-14 max-w-lg grid-cols-4">
          {MOBILE_PRIMARY_TAB_IDS.map((id) => {
            const item = getPrimaryNavLink(id);
            const isActive = matchesNavPath(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-200 ease-out-soft',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {TAB_ICONS[item.id]}
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-200 ease-out-soft',
              isMoreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
            aria-expanded={isMoreOpen}
            aria-haspopup="dialog"
            onClick={() => setIsMoreOpen(true)}
          >
            <MoreHorizontalIcon className="size-5" strokeWidth={1.5} aria-hidden />
            <span>{NAV_COPY.more}</span>
          </button>
        </div>
      </nav>
      <MoreSheet open={isMoreOpen} onOpenChange={setIsMoreOpen} />
    </>
  );
}
