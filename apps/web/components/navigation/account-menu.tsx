'use client';

import { Menu } from '@base-ui/react/menu';
import { LogOutIcon, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import { NAV_COPY } from '@/components/navigation/nav-config';
import { ThemeModeMenuItems } from '@/components/navigation/theme-mode-control';
import { ADMIN_ROUTES, AUTH_ADMIN_ROLE } from '@/constants';
import { authClient } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function UserAvatar({
  image,
  initial,
  sizeClass,
}: {
  image: string | null;
  initial: string;
  sizeClass: string;
}) {
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

export function useNavAccount() {
  const { data, isPending } = authClient.useSession();
  const user = data?.user ?? null;
  const username = user?.username?.trim() || user?.name?.trim() || '读者';
  const email = user?.email?.trim() || '';
  const initial = username.slice(0, 1).toUpperCase();
  const image = user?.image?.trim() || null;
  const isAdmin = user?.role === AUTH_ADMIN_ROLE;

  async function signOut() {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error(error.message || '退出登录失败，请稍后重试');
      return;
    }
    toast.success('已退出登录');
    window.location.assign('/');
  }

  return {
    user,
    isPending,
    username,
    email,
    initial,
    image,
    isAdmin,
    signOut: () => void signOut(),
  };
}

type AccountMenuProps = {
  username: string;
  email: string;
  initial: string;
  image: string | null;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
  triggerClassName?: string;
};

export function AccountMenu({
  username,
  email,
  initial,
  image,
  isAdmin,
  open,
  onOpenChange,
  onSignOut,
  triggerClassName,
}: AccountMenuProps) {
  return (
    <Menu.Root open={open} onOpenChange={onOpenChange}>
      <Menu.Trigger
        className={cn(
          'flex size-9 items-center justify-center overflow-hidden rounded-full',
          'outline-none transition-opacity duration-300 ease-out-soft hover:opacity-90',
          'focus-visible:ring-3 focus-visible:ring-ring/50',
          triggerClassName,
        )}
        aria-label={`${username}，${email}，${NAV_COPY.account}`}
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
            <ThemeModeMenuItems />
            <div className="mx-1 my-1 h-px bg-border" role="separator" />
            {isAdmin ? (
              <Menu.Item
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                  'text-foreground outline-none select-none',
                  'data-highlighted:bg-muted',
                )}
                onClick={() => {
                  window.location.assign(ADMIN_ROUTES.works);
                }}
              >
                <Settings2 className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                {NAV_COPY.admin}
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
              {NAV_COPY.signOut}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
