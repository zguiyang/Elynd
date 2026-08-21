'use client';

import { createContext, type ReactNode, useContext, useEffect } from 'react';

import { GlobalLoading } from '@/components/global-loading';
import { SiteNav } from '@/components/site-nav';
import { AUTH_ROUTES } from '@/constants';
import { authClient, type User } from '@/lib/auth';

/**
 * Thin adapter over Better Auth session for shell children.
 */
const AppUserContext = createContext<User | null>(null);

export function useAppUser() {
  return useContext(AppUserContext);
}

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const { data, error, isPending } = authClient.useSession();
  const user = data?.user ?? null;

  useEffect(() => {
    if (isPending) {
      return;
    }
    if (error || !user) {
      window.location.replace(AUTH_ROUTES.signIn);
    }
  }, [error, isPending, user]);

  if (isPending) {
    return <GlobalLoading />;
  }

  if (error || !user) {
    return (
      <div className="flex h-dvh flex-1 items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">正在跳转登录…</p>
      </div>
    );
  }

  return (
    <AppUserContext.Provider value={user}>
      <div className="flex h-dvh flex-col overflow-hidden">
        <SiteNav />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="container py-6 md:py-12">{children}</div>
        </main>
      </div>
    </AppUserContext.Provider>
  );
}
