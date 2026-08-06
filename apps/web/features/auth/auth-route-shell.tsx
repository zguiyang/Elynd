'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { AUTH_ROUTES } from '@/constants';
import { AuthLayout } from '@/features/auth/auth-layout';

const headerByPath: Record<string, { href: string; label: string }> = {
  [AUTH_ROUTES.signIn]: { href: AUTH_ROUTES.signUp, label: '注册' },
  [AUTH_ROUTES.signUp]: { href: AUTH_ROUTES.signIn, label: '登录' },
  [AUTH_ROUTES.forgotPassword]: { href: AUTH_ROUTES.signIn, label: '返回登录' },
  [AUTH_ROUTES.resetPassword]: { href: AUTH_ROUTES.forgotPassword, label: '重新申请' },
};

export function AuthRouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const headerAction = headerByPath[pathname];

  return <AuthLayout headerAction={headerAction}>{children}</AuthLayout>;
}
