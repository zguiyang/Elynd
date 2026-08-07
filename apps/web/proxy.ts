import { type NextRequest, NextResponse } from 'next/server';

import { AUTH_HINT_COOKIE, resolveOptimisticAuthRedirect } from '@/lib/auth';

export function proxy(request: NextRequest) {
  const hasAuthHint = Boolean(request.cookies.get(AUTH_HINT_COOKIE)?.value);
  const redirectTo = resolveOptimisticAuthRedirect(request.nextUrl.pathname, hasAuthHint);

  if (!redirectTo) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = redirectTo;
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/dashboard/:path*', '/sign-in', '/sign-up'],
};
