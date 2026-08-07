import { NextResponse } from 'next/server';

import { expiredSessionCookieOptions, SESSION_COOKIE } from '@/lib/auth/session-gate';

const apiInternalUrl = () => process.env.API_INTERNAL_URL ?? 'http://localhost:3333';

/** Clear HttpOnly session cookie on the web origin, then notify Adonis. */
export async function DELETE(request: Request) {
  try {
    await fetch(`${apiInternalUrl()}/api/auth/logout`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
    });
  } catch {
    // still clear local cookie
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', expiredSessionCookieOptions());
  return response;
}
