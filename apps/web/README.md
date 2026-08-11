# `@elynd/web`

Next.js App Router frontend for Elynd (port **3000**).

## Scripts

```bash
pnpm --filter @elynd/web dev
pnpm --filter @elynd/web test
pnpm --filter @elynd/web typecheck
pnpm --filter @elynd/web lint
```

## Auth (session, soft UX)

See [`lib/auth/README.md`](./lib/auth/README.md).

- Soft: cookie presence in `proxy.ts`; client get-session + 401 → sign-in.
- Hard: Hono Better Auth session + `requireAuth` on protected API routes.
- Logout clears HttpOnly `better-auth.session_token` via Next `DELETE /api/auth/logout`.
