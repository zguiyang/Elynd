import { redirect } from 'next/navigation';

import { AUTH_ROUTES } from '@/constants';

/** Legacy home path → 我的书架. */
export default function DashboardRedirectPage() {
  redirect(AUTH_ROUTES.shelf);
}
