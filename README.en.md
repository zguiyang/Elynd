# Elynd

[中文](./README.md) | English

---

## Product

**Elynd** is an English **learning space** for adults who struggle to stick with learning. It centers interesting, mostly understandable real content (reading + listening). Tools—including AI—**lower friction**. It is not a course platform, vocab pack, or chatbot.

Target users: adults with mid/weak English who need it for work or life, and who repeatedly abandon courses and apps.

Product vision and decision docs (English SSOT): [`docs/product/`](./docs/product/).

### Product direction (main loop)

| Space         | Role                                                |
| ------------- | --------------------------------------------------- |
| Library       | Discover level-fit content worth finishing          |
| Learning Room | Read / listen + on-demand comprehension help        |
| Practice      | Light checks and expression **after** understanding |
| Review        | Re-meet important expressions in context            |
| Progress      | Time-with-language and habit (not exam ranks)       |

> The first **engineering** loop is **sign-up / sign-in (Adonis session cookie) / dashboard**. Learning-loop targets: [`docs/product/mvp-scope.md`](./docs/product/mvp-scope.md).

## Stack

| Layer    | Tech                                                                                 |
| -------- | ------------------------------------------------------------------------------------ |
| API      | AdonisJS 7, Lucid, PostgreSQL, Redis (port **6380**), session cookie (port **3333**) |
| Web      | Next.js App Router, React, TanStack Query/Form, Tailwind CSS v4 (port **3000**)      |
| Packages | pnpm workspace (`apps/*`, `packages/*`); shared package `@elynd/shared`              |

## Requirements

| Tool    | Version                              |
| ------- | ------------------------------------ |
| Node.js | ≥ 24.0.0                             |
| pnpm    | ≥ 10.0.0                             |
| Docker  | optional, for local Postgres + Redis |

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

- Postgres: `127.0.0.1:5433` (Adonis DB name in `apps/backend/.env.example` → `DB_DATABASE`)
- Redis: `127.0.0.1:6380` (`REDIS_HOST` / `REDIS_PORT`)

### 2. Environment files

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/backend/.env` as needed (`APP_KEY`, `DB_*`, `REDIS_*`, `RESEND_API_KEY`, …). Generate `APP_KEY`:

```bash
cd apps/backend && node ace generate:key
```

### 3. Run DB migrations

```bash
cd apps/backend && node ace migration:run
```

### 4. Run apps

```bash
# Terminal 1: API http://localhost:3333
pnpm run dev:backend

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
```

## Production deploy

An Adonis / Next production deploy pipeline is not in this repository yet.

## License

See [LICENSE](./LICENSE).
