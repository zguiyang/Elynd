# Auth (web)

Cookie-session Better Auth via `@elynd/auth/client`. No Bearer tokens in `localStorage`.

## Proxy

Next rewrites same-origin `/api/:path*` to the Nest API (`API_INTERNAL_URL`, default `http://localhost:3336`). The auth client uses `baseURL` of the app origin (or `''`) so browser calls hit `/api/auth/*` on Next, which proxies to Nest. Session cookies stay first-party / same-site.

## Gates

| Layer                                     | What it checks                                                        | Trust                                                          |
| ----------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| Optimistic (middleware / cookie presence) | Session cookie exists                                                 | UX only — can be stale or forged-looking; never authorize data |
| Real validation                           | `authClient.getSession()` (or Nest AuthGuard / `auth.api.getSession`) | Authoritative — required before protected UI/API work          |

Protected pages (e.g. dashboard) must validate the session with the API, not cookie presence alone.
