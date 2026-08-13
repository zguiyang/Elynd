import Link from 'next/link';

import { APP_NAME, AUTH_ROUTES } from '@/constants';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{APP_NAME}</h1>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <Link
          href={AUTH_ROUTES.signIn}
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/80"
        >
          登录
        </Link>
        <Link
          href={AUTH_ROUTES.signUp}
          className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-3 font-medium hover:bg-muted"
        >
          注册
        </Link>
        <Link
          href={AUTH_ROUTES.dashboard}
          className="inline-flex h-8 items-center rounded-lg px-3 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          今日
        </Link>
      </div>
    </main>
  );
}
