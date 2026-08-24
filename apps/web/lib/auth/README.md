# Auth (`apps/web/lib/auth`)

Frontend only does **soft UX** + Better Auth **client**. Real auth is Hono Better Auth on `/api/auth/*`.

| Layer                     | Behavior                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `proxy.ts`                | Rewrite `/api/*` → Hono; public page access is not gated here                      |
| `baClient` / façade       | `better-auth/react` → same-origin `/api/auth/*`                                    |
| `useSession` / forms      | Session via BA get-session; login/register/forgot-password live in AuthDialog      |
| `DELETE /api/auth/logout` | Next clears `better-auth.session_token`, then calls Hono `POST /api/auth/sign-out` |

Do not treat proxy or client checks as security controls — API authz is `requireAuth` on Hono.
