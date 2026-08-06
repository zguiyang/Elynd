'use client';

import { Menu } from '@base-ui/react/menu';
import { EllipsisVertical, Library, LogOut, RotateCcw, Sun, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useContext, useEffect } from 'react';
import { toast } from 'sonner';

import type { AuthUser } from '@elynd/auth/server';

import { BrandMark } from '@/components/brand-mark';
import { AUTH_ROUTES } from '@/constants';
import { authClient } from '@/lib/auth';
import { cn } from '@/lib/utils';

/**
 * Thin adapter over Better Auth `useSession` for shell children.
 * Session SoT remains the auth client cache (refetch on full reload / auth mutations).
 */
const AppUserContext = createContext<AuthUser | null>(null);

export function useAppUser() {
  return useContext(AppUserContext);
}

const navItems = [
  { href: AUTH_ROUTES.dashboard, label: '今日', icon: Sun, active: true, disabled: false },
  { href: '#', label: '图书馆', icon: Library, active: false, disabled: true },
  { href: '#', label: '复习', icon: RotateCcw, active: false, disabled: true },
  { href: '#', label: '成长', icon: TrendingUp, active: false, disabled: true },
] as const;

type AppShellProps = {
  children: ReactNode;
};

type UserIdentityProps = {
  username: string;
  email: string;
  initial: string;
  image: string | null;
  onSignOut: () => void;
};

function UserAvatar({
  image,
  initial,
  sizeClass,
  textClass,
}: {
  image: string | null;
  initial: string;
  sizeClass: string;
  textClass: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote DiceBear SVG URL; no Next Image optimizer needed
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
        textClass,
      )}
    >
      {initial}
    </div>
  );
}

function AccountMenuContent({ username, email, initial, image, onSignOut }: UserIdentityProps) {
  return (
    <>
      <div className="flex items-center gap-3 px-2.5 py-2.5">
        <UserAvatar image={image} initial={initial} sizeClass="size-10" textClass="text-sm" />
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
        <LogOut className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        退出登录
      </Menu.Item>
    </>
  );
}

function SidebarUserFooter({ username, email, initial, image, onSignOut }: UserIdentityProps) {
  return (
    <div className="shrink-0 border-t border-sidebar-border pt-3">
      <Menu.Root modal={false}>
        <Menu.Trigger
          openOnHover
          delay={100}
          closeDelay={320}
          className={cn(
            'group flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left',
            'outline-none transition-colors duration-200 ease-out-soft',
            'hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50',
            'data-popup-open:bg-muted/50',
          )}
          aria-label="账户菜单"
        >
          <UserAvatar image={image} initial={initial} sizeClass="size-8" textClass="text-xs" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{username}</div>
            <div className="truncate text-xs text-muted-foreground">{email}</div>
          </div>
          <EllipsisVertical
            className="size-4 shrink-0 text-muted-foreground transition-colors duration-200 ease-out-soft group-data-[popup-open]:text-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            className={cn(
              'z-50 outline-none',
              // Invisible hover bridge between trigger and side popover.
              'before:absolute before:content-[""]',
              'data-[side=right]:before:inset-y-0 data-[side=right]:before:left-[-10px] data-[side=right]:before:w-2.5',
            )}
            side="right"
            sideOffset={8}
            align="end"
          >
            <Menu.Popup
              className={cn(
                'min-w-56 rounded-xl bg-card p-1 shadow-card ring-1 ring-foreground/5 outline-none',
                'transition-opacity duration-200 ease-out-soft',
                'data-starting-style:opacity-0 data-ending-style:opacity-0',
              )}
            >
              <AccountMenuContent
                username={username}
                email={email}
                initial={initial}
                image={image}
                onSignOut={onSignOut}
              />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

function MobileAccountMenu({ username, email, initial, image, onSignOut }: UserIdentityProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          'flex size-9 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-medium text-accent-foreground',
          'outline-none transition-opacity duration-300 ease-out-soft hover:opacity-90',
          'focus-visible:ring-3 focus-visible:ring-ring/50',
        )}
        aria-label={`${username}，${email}，账户菜单`}
      >
        <UserAvatar image={image} initial={initial} sizeClass="size-9" textClass="text-sm" />
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
            <AccountMenuContent
              username={username}
              email={email}
              initial={initial}
              image={image}
              onSignOut={onSignOut}
            />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { data, error, isPending } = authClient.useSession();
  const user = (data?.user as AuthUser | undefined) ?? null;

  useEffect(() => {
    if (isPending) {
      return;
    }
    if (error || !user) {
      router.replace(AUTH_ROUTES.signIn);
    }
  }, [error, isPending, router, user]);

  async function handleSignOut() {
    const { error: signOutError } = await authClient.signOut();
    if (signOutError) {
      toast.error(signOutError.message || '退出登录失败，请重试');
      return;
    }
    toast.success('已退出登录');
    router.replace(AUTH_ROUTES.signIn);
    router.refresh();
  }

  if (isPending || !user) {
    return (
      <div className="flex h-dvh flex-1 items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </div>
    );
  }

  const username = user.username?.trim() || user.name?.trim() || '读者';
  const email = user.email?.trim() || '—';
  const initial = username.slice(0, 1).toUpperCase();
  const image = user.image?.trim() || null;
  const onSignOut = () => void handleSignOut();
  const identity = { username, email, initial, image, onSignOut };

  return (
    <AppUserContext.Provider value={user}>
      <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
        <header className="flex shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-5 py-4 md:hidden">
          <BrandMark href={AUTH_ROUTES.dashboard} />
          <MobileAccountMenu {...identity} />
        </header>

        <aside className="hidden h-full w-72 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar px-7 pt-7 pb-3 md:flex">
          <div className="min-h-0 flex-1">
            <BrandMark href={AUTH_ROUTES.dashboard} size="md" subtitle="Digital Reading Room" className="mb-12" />

            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                if (item.disabled) {
                  return (
                    <span
                      key={item.label}
                      aria-disabled
                      className="flex cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-muted-foreground/60"
                    >
                      <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                      {item.label}
                    </span>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 transition-colors duration-300 ease-out-soft',
                      item.active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <SidebarUserFooter {...identity} />
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto p-6 md:p-12">{children}</main>
      </div>
    </AppUserContext.Provider>
  );
}
