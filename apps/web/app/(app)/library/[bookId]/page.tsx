import { redirect } from 'next/navigation';

import { AUTH_ROUTES } from '@/constants';

type LibraryBookRedirectProps = {
  params: Promise<{ bookId: string }>;
};

/** Soft redirect from former /library/:id book detail paths. */
export default async function LibraryBookRedirectPage({ params }: LibraryBookRedirectProps) {
  const { bookId } = await params;
  redirect(AUTH_ROUTES.bookDetail(bookId));
}
