'use client';

import { SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { AccountMenu, useNavAccount } from '@/components/navigation/account-menu';
import { DesktopNav } from '@/components/navigation/desktop-nav';
import { NAV_COPY } from '@/components/navigation/nav-config';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AUTH_ROUTES } from '@/constants';
import { cn } from '@/lib/utils';

function SearchPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden
      />
      <Input
        type="search"
        readOnly
        tabIndex={-1}
        placeholder={NAV_COPY.searchPlaceholder}
        aria-label={NAV_COPY.searchPlaceholder}
        className="h-9 w-48 cursor-default rounded-md border-border bg-card pl-9 text-sm shadow-none focus-visible:border-border focus-visible:ring-0"
        onFocus={(event) => event.currentTarget.blur()}
      />
    </div>
  );
}

/**
 * Top site chrome for Landing + AppShell.
 * Desktop: primary links in-header. Mobile (App): Brand + Avatar only — tabs live in MobileBottomNav.
 */
export function SiteNav() {
  const { user, isPending, username, email, initial, image, isAdmin, signOut } = useNavAccount();
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-sm">
      <nav className="container flex h-16 items-center justify-between gap-6 md:h-20" aria-label="站点顶栏">
        <div className="flex min-w-0 items-center gap-8">
          <BrandMark href="/" name={NAV_COPY.wordmark} appearance="editorial" size="md" className="shrink-0" />
          <div className="hidden md:block">
            {isPending ? <Skeleton className="h-6 w-80 rounded-md" /> : <DesktopNav />}
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          {isPending ? (
            <Skeleton className="size-9 rounded-full md:h-9 md:w-40 md:rounded-md" />
          ) : user ? (
            <>
              <SearchPlaceholder className="hidden md:block" />
              <AccountMenu
                username={username}
                email={email}
                initial={initial}
                image={image}
                isAdmin={isAdmin}
                open={isAccountOpen}
                onOpenChange={setIsAccountOpen}
                onSignOut={signOut}
              />
            </>
          ) : (
            <Link
              href={AUTH_ROUTES.signIn}
              className="text-base font-medium text-primary transition-opacity duration-200 ease-out-soft hover:opacity-80"
            >
              {NAV_COPY.signIn}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
