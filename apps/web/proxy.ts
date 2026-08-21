import { type NextRequest, NextResponse } from 'next/server';

import { hasSessionCookie, resolveAuthPageRedirect } from '@/lib/auth/session-gate';

/** Soft page gate (cookie presence) + API rewrite. Real auth is Hono Better Auth. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Stay on Next (do not rewrite): logout clears HttpOnly cookie; SSE must
  // stream through a Route Handler — proxy rewrites can buffer until done.
  if (pathname === '/api/auth/logout' || pathname === '/api/assist/ask' || pathname === '/api/translate/article') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.rewrite(new URL(`${pathname}${request.nextUrl.search}`, process.env.API_INTERNAL_URL));
  }

  const redirectTo = resolveAuthPageRedirect(
    pathname,
    hasSessionCookie((name) => request.cookies.get(name)?.value),
  );
  if (!redirectTo) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = redirectTo;
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/my-shelf',
    '/my-shelf/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/library/:path*',
    '/progress',
    '/progress/:path*',
    '/learn/:path*',
    '/admin/:path*',
    '/sign-in',
    '/sign-up',
    '/api/:path*',
  ],
};
