import type { ReactNode } from 'react';

import { AuthRouteShell } from '@/features/auth/auth-route-shell';

export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return <AuthRouteShell>{children}</AuthRouteShell>;
}
