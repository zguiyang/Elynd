'use client';

import { ArrowLeft, AudioLines, FileText, ScrollText, Sparkles, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';

import { isAdminRole } from '@gloaming/shared/auth/policy';

import { BrandMark } from '@/components/brand-mark';
import { GlobalLoading } from '@/components/global-loading';
import { Button } from '@/components/ui/button';
import { ADMIN_ROUTES, AUTH_ROUTES } from '@/constants';
import { useAuthDialog } from '@/features/auth';
import { authClient } from '@/lib/auth';
import { cn } from '@/lib/utils';

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const { data, isPending } = authClient.useSession();
  const { openLogin } = useAuthDialog();
  const user = data?.user ?? null;

  if (isPending) {
    return <GlobalLoading />;
  }

  if (!user) {
    return (
      <div className="flex h-dvh flex-1 items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">请先登录后再进入管理后台。</p>
          <Button type="button" className="mt-5 rounded-full px-6" onClick={() => openLogin()}>
            登录
          </Button>
        </div>
      </div>
    );
  }

  if (!isAdminRole(user.role)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-10">
        <section className="w-full max-w-md rounded-3xl border border-border bg-card px-8 py-10 text-center">
          <div className="mb-8 flex justify-center">
            <BrandMark href={AUTH_ROUTES.shelf} subtitle="管理后台" />
          </div>
          <p className="mb-3 text-sm font-medium tracking-[0.16em] text-primary">无权限</p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">无法进入管理后台</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            当前账号没有管理员权限。管理后台只对内容维护人员开放，你仍然可以返回首页继续阅读。
          </p>
          <Button nativeButton={false} className="mt-8 rounded-xl px-5" render={<Link href={AUTH_ROUTES.shelf} />}>
            返回首页
          </Button>
        </section>
      </div>
    );
  }

  const isArticlesActive = pathname.startsWith(ADMIN_ROUTES.articles);
  const isAiActive = pathname === ADMIN_ROUTES.ai || pathname.startsWith(`${ADMIN_ROUTES.ai}/`);
  const isAiLogsActive = pathname === ADMIN_ROUTES.aiLogs || pathname.startsWith(`${ADMIN_ROUTES.aiLogs}/`);
  const isTtsActive = pathname === ADMIN_ROUTES.tts || pathname.startsWith(`${ADMIN_ROUTES.tts}/`);
  const isTtsLogsActive = pathname === ADMIN_ROUTES.ttsLogs || pathname.startsWith(`${ADMIN_ROUTES.ttsLogs}/`);

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <header className="flex shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-5 py-4 md:hidden">
        <BrandMark href={ADMIN_ROUTES.articles} subtitle="内容管理" />
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="gap-1.5 text-muted-foreground transition-colors duration-300 ease-out-soft hover:text-foreground"
          render={<Link href={AUTH_ROUTES.shelf} />}
        >
          <ArrowLeft data-icon="inline-start" />
          首页
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
            <Button
              variant="ghost"
              nativeButton={false}
              className={cn(
                'h-auto justify-start gap-3 rounded-xl px-4 py-3 text-base font-normal transition-colors duration-300 ease-out-soft',
                isAiActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              render={<Link href={ADMIN_ROUTES.ai} />}
            >
              <Sparkles data-icon="inline-start" />
              AI 配置
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              className={cn(
                'h-auto justify-start gap-3 rounded-xl px-4 py-3 text-base font-normal transition-colors duration-300 ease-out-soft',
                isAiLogsActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              render={<Link href={ADMIN_ROUTES.aiLogs} />}
            >
              <ScrollText data-icon="inline-start" />
              AI 日志
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              className={cn(
                'h-auto justify-start gap-3 rounded-xl px-4 py-3 text-base font-normal transition-colors duration-300 ease-out-soft',
                isTtsActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              render={<Link href={ADMIN_ROUTES.tts} />}
            >
              <Volume2 data-icon="inline-start" />
              语音配置
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              className={cn(
                'h-auto justify-start gap-3 rounded-xl px-4 py-3 text-base font-normal transition-colors duration-300 ease-out-soft',
                isTtsLogsActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              render={<Link href={ADMIN_ROUTES.ttsLogs} />}
            >
              <AudioLines data-icon="inline-start" />
              音频日志
            </Button>
          </nav>
        </div>

        <Button
          variant="ghost"
          nativeButton={false}
          className="mt-4 h-auto justify-start gap-2 rounded-xl px-4 py-3 font-normal text-muted-foreground transition-colors duration-300 ease-out-soft hover:bg-muted hover:text-foreground"
          render={<Link href={AUTH_ROUTES.shelf} />}
        >
          <ArrowLeft data-icon="inline-start" />
          返回首页
        </Button>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto p-6 md:p-12">{children}</main>
    </div>
  );
}
