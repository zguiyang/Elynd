'use client';

import { Menu } from '@base-ui/react/menu';
import { LogOutIcon, MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { AUTH_ROUTES } from '@/constants';
import { useLandingUser } from '@/features/landing/landing-auth';
import { landingCopy as c } from '@/features/landing/landing-copy';
import { authClient } from '@/lib/auth';
import { cn } from '@/lib/utils';

const guestLinks = [{ href: '#philosophy', label: c.nav.philosophy }] as const;

const authedLinks = [
  { href: AUTH_ROUTES.dashboard, label: c.nav.shelf },
  { href: AUTH_ROUTES.library, label: c.nav.discover },
  { href: AUTH_ROUTES.progress, label: c.nav.history },
] as const;

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 ease-out-soft hover:text-primary"
    >
      {label}
    </Link>
  );
}

function GuestActions({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <div className={cn('flex items-center', compact ? 'w-full flex-col gap-3' : 'gap-1')}>
      <Button
        nativeButton={false}
        variant="ghost"
        className={cn('h-auto rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground', compact && 'w-full')}
        render={<Link href={AUTH_ROUTES.signIn} onClick={onNavigate} />}
      >
        {c.nav.signIn}
      </Button>
      <Button
        nativeButton={false}
        className={cn(
          'h-auto rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-brand-deep',
          compact && 'w-full',
        )}
        render={<Link href={AUTH_ROUTES.signUp} onClick={onNavigate} />}
      >
        {c.nav.cta}
      </Button>
    </div>
  );
}

function UserAvatar({ image, initial, sizeClass }: { image: string | null; initial: string; sizeClass: string }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar URL
      <img
        src={image}
        alt=""
        className={cn(sizeClass, 'shrink-0 rounded-full bg-muted object-cover')}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        'flex shrink-0 items-center justify-center rounded-full bg-accent font-medium text-accent-foreground',
      )}
    >
      {initial}
    </div>
  );
}

function AccountMenu({
  username,
  email,
  initial,
  image,
  onSignOut,
}: {
  username: string;
  email: string;
  initial: string;
  image: string | null;
  onSignOut: () => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          'flex size-9 items-center justify-center overflow-hidden rounded-full',
          'outline-none transition-opacity duration-300 ease-out-soft hover:opacity-90',
          'focus-visible:ring-3 focus-visible:ring-ring/50',
        )}
        aria-label={`${username}，${email}，${c.nav.account}`}
      >
        <UserAvatar image={image} initial={initial} sizeClass="size-9 text-sm" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50 outline-none" sideOffset={8} align="end">
          <Menu.Popup
            className={cn(
              'min-w-56 rounded-xl bg-card p-1 shadow-card ring-1 ring-foreground/5 outline-none',
              'transition-opacity duration-200 ease-out-soft',
              'data-starting-style:opacity-0 data-ending-style:opacity-0',
            )}
          >
            <div className="flex items-center gap-3 px-2.5 py-2.5">
              <UserAvatar image={image} initial={initial} sizeClass="size-10 text-sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{username}</div>
                <div className="truncate text-xs text-muted-foreground">{email}</div>
              </div>
            </div>
            <div className="mx-1 my-1 h-px bg-border" role="separator" />
            <Menu.Item
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                'text-foreground outline-none select-none',
                'data-highlighted:bg-muted',
              )}
              onClick={onSignOut}
            >
              <LogOutIcon className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
              {c.nav.signOut}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function LandingNav() {
  const { user, isPending } = useLandingUser();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const links = user ? authedLinks : guestLinks;

  async function handleSignOut() {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error(error.message || '退出登录失败，请稍后重试');
      return;
    }
    toast.success('已退出登录');
    window.location.assign('/');
  }

  const username = user?.username?.trim() || user?.name?.trim() || '读者';
  const email = user?.email?.trim() || '';
  const initial = username.slice(0, 1).toUpperCase();
  const image = user?.image?.trim() || null;

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm">
      <nav
        className="mx-auto flex max-w-container-max items-center justify-between px-6 py-5 md:px-8"
        aria-label="主导航"
      >
        <BrandMark href="/" wordmark={false} />

        <div className="hidden items-center md:flex">
          {isPending ? (
            <Skeleton className="h-10 w-56 rounded-xl" />
          ) : user ? (
            <>
              {links.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
              <AccountMenu
                username={username}
                email={email}
                initial={initial}
                image={image}
                onSignOut={() => void handleSignOut()}
              />
            </>
          ) : (
            <>
              {links.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
              <GuestActions />
            </>
          )}
        </div>

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('rounded-xl md:hidden', user && 'overflow-hidden rounded-full p-0')}
                aria-label={user ? c.nav.account : c.nav.menu}
              />
            }
          >
            {user ? (
              <UserAvatar image={image} initial={initial} sizeClass="size-8 text-xs" />
            ) : (
              <MenuIcon strokeWidth={1.5} />
            )}
          </SheetTrigger>
          <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
            <SheetHeader className="border-b border-border/80 px-5 py-4 text-left">
              <SheetTitle>菜单</SheetTitle>
              <SheetDescription className="sr-only">站点导航</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-5 py-6">
              {isPending ? (
                <Skeleton className="h-24 w-full rounded-xl" />
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    {links.map((item) => (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        onClick={() => setIsSheetOpen(false)}
                      />
                    ))}
                  </div>
                  {user ? (
                    <div className="flex flex-col gap-4 border-t border-border/80 pt-6">
                      <div className="flex items-center gap-3">
                        <UserAvatar image={image} initial={initial} sizeClass="size-10 text-sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{username}</p>
                          <p className="truncate text-xs text-muted-foreground">{email}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto justify-start gap-2 rounded-xl px-4 py-2.5"
                        onClick={() => {
                          setIsSheetOpen(false);
                          void handleSignOut();
                        }}
                      >
                        <LogOutIcon className="size-4" strokeWidth={1.5} aria-hidden />
                        {c.nav.signOut}
                      </Button>
                    </div>
                  ) : (
                    <GuestActions compact onNavigate={() => setIsSheetOpen(false)} />
                  )}
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
