# Run on a VPS (Node)

Postgres and Redis run in Docker Compose. The Hono API and the BullMQ worker are two Node processes on the host. Containerizing those processes can wait.

## Prerequisites

- Node.js 24+
- pnpm
- Docker

## Steps

1. Clone the repo and run `pnpm install`.
2. `pnpm compose:init` then `docker compose up -d` (Postgres + Redis only).
3. Copy [`apps/backend/.env.example`](../apps/backend/.env.example) to `apps/backend/.env`. Set `HOST=0.0.0.0`. Point `DATABASE_URL` and `REDIS_URL` at the compose host ports (example: `5433` / `6380`).
4. `pnpm db:migrate`
5. `pnpm --filter @elynd/backend build`
6. Run both processes:

```bash
pnpm --filter @elynd/backend start
pnpm --filter @elynd/backend worker
```

The API only enqueues. `POST /api/admin/jobs/ping` (admin session) is the smoke path. The worker consumes the `elynd` queue.

## Process manager sketches

systemd — two units, same working directory, different `ExecStart`:

```text
ExecStart=/usr/bin/pnpm --filter @elynd/backend start
ExecStart=/usr/bin/pnpm --filter @elynd/backend worker
```

pm2, from `apps/backend` after build:

```bash
pm2 start dist/index.js --name elynd-api
pm2 start dist/worker.js --name elynd-worker
```

Local Next.js is out of scope here. Do not put the API or worker into Compose until you containerize them.
