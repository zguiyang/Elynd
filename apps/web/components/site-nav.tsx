'use client';

import { Menu } from '@base-ui/react/menu';
import { LogOutIcon, MenuIcon, SearchIcon, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ADMIN_ROUTES, AUTH_ADMIN_ROLE, AUTH_ROUTES } from '@/constants';
import { authClient } from '@/lib/auth';
import { cn } from '@/lib/utils';

const SITE_NAV = {
  wordmark: 'Gloaming',
  discover: '发现',
  shelf: '我的书架',
  history: '阅读历史',
  settings: '设置',
  signIn: '登录',
  searchPlaceholder: '搜索…',
  menu: '打开菜单',
  account: '账户菜单',
  signOut: '退出登录',
  admin: '管理后台',
} as const;

type NavLinkItem = {
  href: string;
  label: string;
};

const primaryLinks: NavLinkItem[] = [
  { href: AUTH_ROUTES.library, label: SITE_NAV.discover },
  { href: AUTH_ROUTES.shelf, label: SITE_NAV.shelf },
  { href: AUTH_ROUTES.progress, label: SITE_NAV.history },
];

function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
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

function NavTextLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick} aria-current={active ? 'page' : undefined} className="site-nav-link">
      {label}
    </Link>
  );
}

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
        placeholder={SITE_NAV.searchPlaceholder}
        aria-label={SITE_NAV.searchPlaceholder}
        className="h-9 w-48 cursor-default rounded-md border-border bg-card pl-9 text-sm shadow-none focus-visible:border-border focus-visible:ring-0"
        onFocus={(event) => event.currentTarget.blur()}
      />
    </div>
  );
}

function AccountMenuItems({
  username,
  email,
  initial,
  image,
  isAdmin,
  onSignOut,
  onNavigate,
}: {
  username: string;
  email: string;
  initial: string;
  image: string | null;
  isAdmin: boolean;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 px-2.5 py-2.5">
        <UserAvatar image={image} initial={initial} sizeClass="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{username}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        </div>
      </div>
      <div className="mx-1 my-1 h-px bg-border" role="separator" />
      {isAdmin ? (
        <Menu.Item
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
            'text-foreground outline-none select-none',
            'data-highlighted:bg-muted',
          )}
          onClick={() => {
            onNavigate?.();
            window.location.assign(ADMIN_ROUTES.articles);
          }}
        >
          <Settings2 className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          {SITE_NAV.admin}
        </Menu.Item>
      ) : null}
      <Menu.Item
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
          'text-foreground outline-none select-none',
          'data-highlighted:bg-muted',
        )}
        onClick={onSignOut}
      >
        <LogOutIcon className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        {SITE_NAV.signOut}
      </Menu.Item>
    </>
  );
}

function AccountMenu({
  username,
  email,
  initial,
  image,
  isAdmin,
  open,
  onOpenChange,
  onSignOut,
  triggerClassName,
}: {
  username: string;
  email: string;
  initial: string;
  image: string | null;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
  triggerClassName?: string;
}) {
  return (
    <Menu.Root open={open} onOpenChange={onOpenChange}>
      <Menu.Trigger
        className={cn(
          'flex size-9 items-center justify-center overflow-hidden rounded-full',
          'outline-none transition-opacity duration-300 ease-out-soft hover:opacity-90',
          'focus-visible:ring-3 focus-visible:ring-ring/50',
          triggerClassName,
        )}
        aria-label={`${username}，${email}，${SITE_NAV.account}`}
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
            <AccountMenuItems
              username={username}
              email={email}
              initial={initial}
              image={image}
              isAdmin={isAdmin}
              onSignOut={onSignOut}
            />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function SiteNav() {
  const pathname = usePathname() ?? '/';
  const { data, isPending } = authClient.useSession();
  const user = data?.user ?? null;
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

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
  const isAdmin = user?.role === AUTH_ADMIN_ROLE;
  const onSignOut = () => void handleSignOut();

  function openSettings() {
    if (!user) {
      window.location.assign(AUTH_ROUTES.signIn);
      return;
    }
    setIsAccountOpen(true);
  }

  const desktopLinks = (
    <div className="flex items-center gap-8">
      {primaryLinks.map((item) => (
        <NavTextLink key={item.href} href={item.href} label={item.label} active={matchesPath(pathname, item.href)} />
      ))}
      <button type="button" onClick={openSettings} className="site-nav-link">
        {SITE_NAV.settings}
      </button>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-sm">
      <nav className="container flex h-16 items-center justify-between gap-6 md:h-20" aria-label="主导航">
        <div className="flex min-w-0 items-center gap-8">
          <BrandMark
            href={user ? AUTH_ROUTES.shelf : '/'}
            name={SITE_NAV.wordmark}
            appearance="editorial"
            size="md"
            className="shrink-0"
          />
          <div className="hidden md:block">
            {isPending ? <Skeleton className="h-6 w-80 rounded-md" /> : desktopLinks}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {isPending ? (
            <Skeleton className="hidden h-9 w-40 rounded-md md:block" />
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
                onSignOut={onSignOut}
                triggerClassName="hidden md:flex"
              />
            </>
          ) : (
            <Link
              href={AUTH_ROUTES.signIn}
              className="hidden text-base font-medium text-primary transition-opacity duration-200 ease-out-soft hover:opacity-80 md:inline"
            >
              {SITE_NAV.signIn}
            </Link>
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
                aria-label={user ? SITE_NAV.account : SITE_NAV.menu}
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
                  <div className="flex flex-col gap-4">
                    {primaryLinks.map((item) => (
                      <NavTextLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        active={matchesPath(pathname, item.href)}
                        onClick={() => setIsSheetOpen(false)}
                      />
                    ))}
                    <button
                      type="button"
                      className="site-nav-link w-fit text-left"
                      onClick={() => {
                        setIsSheetOpen(false);
                        openSettings();
                      }}
                    >
                      {SITE_NAV.settings}
                    </button>
                  </div>
                  {user ? (
                    <div className="flex flex-col gap-4 border-t border-border/80 pt-6">
                      {isAdmin ? (
                        <Link
                          href={ADMIN_ROUTES.articles}
                          className="text-sm font-medium text-muted-foreground hover:text-primary"
                          onClick={() => setIsSheetOpen(false)}
                        >
                          {SITE_NAV.admin}
                        </Link>
                      ) : null}
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
                          onSignOut();
                        }}
                      >
                        <LogOutIcon className="size-4" strokeWidth={1.5} aria-hidden />
                        {SITE_NAV.signOut}
                      </Button>
                    </div>
                  ) : (
                    <Link
                      href={AUTH_ROUTES.signIn}
                      className="text-base font-medium text-primary"
                      onClick={() => setIsSheetOpen(false)}
                    >
                      {SITE_NAV.signIn}
                    </Link>
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
