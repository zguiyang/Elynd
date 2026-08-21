import { redirect } from 'next/navigation';

import { AUTH_ROUTES } from '@/constants';

/** Legacy /progress (成长) → reading history. */
export default function ProgressRedirectPage() {
  redirect(AUTH_ROUTES.history);
}
