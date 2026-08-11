import { type NextRequest, NextResponse } from 'next/server';

import { hasSessionCookie, resolveAuthPageRedirect } from '@/lib/auth/session-gate';

/** Soft page gate (cookie presence) + API rewrite. Real auth is Hono Better Auth. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Logout stays on Next so HttpOnly cookie can be cleared on this origin.
  if (pathname === '/api/auth/logout') {
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
  matcher: ['/dashboard/:path*', '/admin/:path*', '/sign-in', '/sign-up', '/api/:path*'],
};
