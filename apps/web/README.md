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

- Soft: cookie presence in `proxy.ts`; client `/me` + 401 → sign-in.
- Hard: Adonis session middleware on the API (rate limits / IP later live there too).
- Logout clears HttpOnly `adonis-session` via Next `DELETE /api/auth/logout`.
