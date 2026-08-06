# Auth (web)

Cookie-session Better Auth via `@elynd/auth/client`. No Bearer tokens in `localStorage`.

## Proxy

Next rewrites same-origin `/api/:path*` to the Nest API (`API_INTERNAL_URL`, default `http://localhost:3336`). The auth client uses `baseURL` of the app origin (or `''`) so browser calls hit `/api/auth/*` on Next, which proxies to Nest. Session cookies stay first-party / same-site.

## Gates

| Layer                            | What it checks                                                       | Trust                                                          |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| Optimistic (`proxy.ts` / cookie) | Session cookie exists (`getElyndSessionCookie`, prefix `elynd-auth`) | UX only — can be stale or forged-looking; never authorize data |
| Real validation                  | `authClient.useSession()` / `getSession()` (or Nest AuthGuard)       | Authoritative — required before protected UI/API work          |

Protected pages (e.g. dashboard) must validate the session with the API, not cookie presence alone.

## Client session cache

- Prefer `authClient.useSession()` in the app shell so identity lives in Better Auth’s client session cache (nanostores).
- In-app client navigations under a mounted `(app)` layout reuse that cache — they should not storm `/api/auth/get-session` on every route change.
- Full document reload (and successful sign-in / sign-out) revalidates against the API.
- Optional `useAppUser()` Context is only a thin adapter for shell children — not a second source of truth. Do **not** put session user in Zustand.

## Nest current user

Authenticated Nest routes use the global AuthGuard + `@Session()` for the current user. Public routes use `@AllowAnonymous()`. Do not add a dedicated `/me` HTTP endpoint unless a real client needs it.
