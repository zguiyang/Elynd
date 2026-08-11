# Auth (`apps/web/lib/auth`)

Frontend only does **soft UX** + Better Auth **client**. Real auth is Hono Better Auth on `/api/auth/*`.

| Layer                     | Behavior                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `proxy.ts`                | Auth-page whitelist + cookie presence redirect; rewrite `/api/*` → Hono            |
| `baClient` / façade       | `better-auth/react` → same-origin `/api/auth/*`                                    |
| `useSession` / forms      | Session via BA get-session; **no session → sign-in**                               |
| `DELETE /api/auth/logout` | Next clears `better-auth.session_token`, then calls Hono `POST /api/auth/sign-out` |

Do not treat proxy or client checks as security controls — API authz is `requireAuth` on Hono.
