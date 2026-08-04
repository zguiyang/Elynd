# Elynd

[中文](./README.md) | English

---

## Product

**Elynd** is an AI-assisted English reading learning tool that combines reading, listen-and-read (TTS), instant dictionary lookup, and article-based AI Q&A.

Target users: adults with weaker English who need it for work.

### Product direction

| Capability         | Description                               |
| ------------------ | ----------------------------------------- |
| Graded reading     | Articles at L1/L2/L3 difficulty           |
| Listen-and-read    | TTS while reading                         |
| Instant dictionary | Tap a word for definitions                |
| AI Q&A             | Questions grounded in the current article |

> The `refactor/v2` branch uses a Nest + Next scaffold. Business features are still migrating from the legacy stack. The first working loop is **sign-up / sign-in (Bearer) / dashboard**.

## Stack

| Layer    | Tech                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| API      | NestJS, Better Auth (Bearer), Drizzle, PostgreSQL, Redis (port **3336**)                 |
| Web      | Next.js App Router, React, TanStack Query/Form, Zustand, Tailwind CSS v4 (port **3000**) |
| Packages | pnpm workspace (`apps/*`, `packages/*`)                                                  |

## Requirements

| Tool    | Version                              |
| ------- | ------------------------------------ |
| Node.js | ≥ 24.0.0                             |
| pnpm    | ≥ 10.0.0                             |
| Docker  | optional, for local Postgres / Redis |

## Local development

```bash
git clone <repository-url>
cd elynd
pnpm install
```

### 1. Start Postgres and Redis

```bash
pnpm compose:init
docker compose up -d
```

Defaults (from the compose example):

- Postgres: `postgresql://root:root@127.0.0.1:5433/app`
- Redis: `127.0.0.1:6380`

### 2. Environment files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env` as needed (`DATABASE_URI`, `AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, …).

### 3. Push DB schema

```bash
pnpm run db:push
```

### 4. Run apps

```bash
# Terminal 1: API http://localhost:3336
pnpm run dev:api

# Terminal 2: Web http://localhost:3000
pnpm run dev:web
```

Open **http://localhost:3000**.

## Common commands

```bash
pnpm compose:init
pnpm run lint
pnpm run format:check
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run db:push
```

## Production deploy

A Nest / Next production deploy pipeline is not in this repository yet. Do not use the removed Adonis deploy scripts.

## Legacy framework code

Root AdonisJS `backend/` and Vue `web/` were removed from this branch. To inspect or migrate legacy features, use branch comparison:

```bash
git diff backup/pre-v2 -- backend web
git show backup/pre-v2:backend/app/controllers/books_controller.ts
```

Reference branches: `backup/pre-v2`, `main`.

## License

See [LICENSE](./LICENSE).
