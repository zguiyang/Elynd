import { type NextRequest, NextResponse } from 'next/server';

import { resolveAuthPageRedirect, SESSION_COOKIE } from '@/lib/auth/session-gate';

const apiInternalUrl = () => process.env.API_INTERNAL_URL ?? 'http://localhost:3333';

/** Soft page gate (cookie presence) + API rewrite. Real auth is Adonis middleware. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Logout stays on Next so HttpOnly cookie can be cleared on this origin.
  if (pathname === '/api/auth/logout') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.rewrite(new URL(`${pathname}${request.nextUrl.search}`, apiInternalUrl()));
  }

  const redirectTo = resolveAuthPageRedirect(pathname, Boolean(request.cookies.get(SESSION_COOKIE)?.value));
  if (!redirectTo) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = redirectTo;
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/dashboard/:path*', '/sign-in', '/sign-up', '/api/:path*'],
};
