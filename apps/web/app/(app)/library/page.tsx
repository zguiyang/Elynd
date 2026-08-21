import { redirect } from 'next/navigation';

import { AUTH_ROUTES } from '@/constants';

/** Soft redirect from the former /library catalog path. */
export default function LibraryRedirectPage() {
  redirect(AUTH_ROUTES.discover);
}
