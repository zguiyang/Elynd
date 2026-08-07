# Auth (`apps/web/lib/auth`)

Frontend only does **soft UX**. Real auth is Adonis session middleware on `/api/*`.

| Layer                     | Behavior                                                                  |
| ------------------------- | ------------------------------------------------------------------------- |
| `proxy.ts`                | Auth-page whitelist + cookie presence redirect; rewrite `/api/*` → Adonis |
| `useSession` / forms      | Call `/api/auth/*` with cookies; **401 → logout → sign-in**               |
| `DELETE /api/auth/logout` | Next clears `adonis-session` (HttpOnly), then calls Adonis                |

Do not treat proxy or client checks as security controls.
