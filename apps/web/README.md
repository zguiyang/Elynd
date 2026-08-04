# `@elynd/web`

Next.js App Router frontend for Elynd (port **3000**).

## Scripts

```bash
pnpm --filter @elynd/web dev
pnpm --filter @elynd/web test
pnpm --filter @elynd/web typecheck
pnpm --filter @elynd/web lint
```

## Auth (cookie + `/api` proxy)

See [`lib/auth/README.md`](./lib/auth/README.md).

- Session: Better Auth **httpOnly cookies** (not Bearer / `localStorage`).
- Browser calls same-origin `/api/*`; Next rewrites to Nest (`API_INTERNAL_URL`).
- Cookie presence is optimistic UX only; use `getSession` (or server session APIs) for real auth gates.
