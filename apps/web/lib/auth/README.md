# Auth client (`apps/web/lib/auth`)

## Model

| Concern         | Mechanism                                                          |
| --------------- | ------------------------------------------------------------------ |
| Credential      | Opaque Adonis access token (Bearer)                                |
| Storage         | `sessionStorage` (`elynd.access_token`)                            |
| Optimistic gate | Non-secret cookie `elynd_auth_hint` for Next `proxy.ts`            |
| Real validation | `GET /api/auth/me` via `authClient.useSession()`                   |
| Transport       | Same-origin `/api/auth/*` rewritten to Adonis (`API_INTERNAL_URL`) |

## Do

- Prefer `authClient.useSession()` in the app shell.
- Optional `useAppUser()` Context is only a thin adapter for shell children — not a second source of truth.
- Do **not** put session user in Zustand.

## Don’t

- Do not store the bearer token in `localStorage` (prefer tab-scoped `sessionStorage`).
- Do not treat the hint cookie as authentication — always confirm with `/me`.
