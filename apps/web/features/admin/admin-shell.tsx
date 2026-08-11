'use client';

import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { ADMIN_ROUTES, AUTH_ROUTES } from '@/constants';
import { authClient } from '@/lib/auth';
import { cn } from '@/lib/utils';

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
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
    return (
      <div className="flex h-dvh flex-1 items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex h-dvh flex-1 items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">正在跳转登录…</p>
      </div>
    );
  }

  const isArticlesActive = pathname.startsWith(ADMIN_ROUTES.articles);

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <header className="flex shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-5 py-4 md:hidden">
        <BrandMark href={ADMIN_ROUTES.articles} subtitle="内容管理" />
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="gap-1.5 text-muted-foreground transition-colors duration-300 ease-out-soft hover:text-foreground"
          render={<Link href={AUTH_ROUTES.dashboard} />}
        >
          <ArrowLeft data-icon="inline-start" />
          学习空间
        </Button>
      </header>

      <aside className="hidden h-full w-72 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar px-7 pt-7 pb-3 md:flex">
        <div className="min-h-0 flex-1">
          <BrandMark href={ADMIN_ROUTES.articles} size="md" subtitle="内容管理" className="mb-12" />

          <nav className="flex flex-col gap-2">
            <Button
              variant="ghost"
              nativeButton={false}
              className={cn(
                'h-auto justify-start gap-3 rounded-xl px-4 py-3 text-base font-normal transition-colors duration-300 ease-out-soft',
                isArticlesActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              render={<Link href={ADMIN_ROUTES.articles} />}
            >
              <FileText data-icon="inline-start" />
              文章
            </Button>
          </nav>
        </div>

        <Button
          variant="ghost"
          nativeButton={false}
          className="mt-4 h-auto justify-start gap-2 rounded-xl px-4 py-3 font-normal text-muted-foreground transition-colors duration-300 ease-out-soft hover:bg-muted hover:text-foreground"
          render={<Link href={AUTH_ROUTES.dashboard} />}
        >
          <ArrowLeft data-icon="inline-start" />
          返回学习空间
        </Button>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto p-6 md:p-12">{children}</main>
    </div>
  );
}
