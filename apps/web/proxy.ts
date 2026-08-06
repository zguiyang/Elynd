import { type NextRequest, NextResponse } from 'next/server';

import { getElyndSessionCookie } from '@elynd/auth/cookies';

import { resolveOptimisticAuthRedirect } from '@/lib/auth/session-gate';

export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(getElyndSessionCookie(request));
  const redirectTo = resolveOptimisticAuthRedirect(request.nextUrl.pathname, hasSessionCookie);

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
