import { type NextRequest, NextResponse } from 'next/server';

/** API rewrite only. Real auth is Hono Better Auth. */
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/my-shelf',
    '/my-shelf/:path*',
    '/discover',
    '/discover/:path*',
    '/reading-history',
    '/reading-history/:path*',
    '/read/:path*',
    '/admin/:path*',
    '/api/:path*',
  ],
};
