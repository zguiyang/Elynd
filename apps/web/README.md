# `@elynd/web`

Next.js App Router frontend for Elynd (port **3000**).

## Scripts

```bash
pnpm --filter @elynd/web dev
pnpm --filter @elynd/web test
pnpm --filter @elynd/web typecheck
pnpm --filter @elynd/web lint
```

## Auth (Bearer + `/api` proxy)

See [`lib/auth/README.md`](./lib/auth/README.md).

- Session: Adonis opaque **access token** in `sessionStorage` (Bearer header).
- Browser calls same-origin `/api/auth/*`; Next rewrites to Adonis (`API_INTERNAL_URL`, default `:3333`).
- Hint cookie is optimistic UX only; use `GET /me` via `authClient.useSession()` for real auth gates.
