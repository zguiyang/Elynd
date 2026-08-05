# AGENTS.md

Guidance for AI coding assistants working in the Elynd repository (Cursor).

## Rules entry

**Source of truth:** [`.cursor/rules/`](.cursor/rules/). Cursor User Rules apply across projects; **project rules win** on conflict.

### Precedence

1. Tooling (ESLint, Prettier, typecheck, tests)
2. Always-on: invariants, layering, decisions, project-overview, common, tdd, git-commit
3. Glob: backend / frontend / packages
4. Current Trellis task + **filled** `.trellis/spec` contracts
5. Skills / MCP
6. User Rules

### Index

| Rule                                                       | When                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| [invariants.mdc](.cursor/rules/invariants.mdc)             | Always — principles (incl. SSOT), cleanup, DoD         |
| [layering.mdc](.cursor/rules/layering.mdc)                 | Always — package/module placement                      |
| [decisions.mdc](.cursor/rules/decisions.mdc)               | Always — create/delete/split/cross-layer               |
| [project-overview.mdc](.cursor/rules/project-overview.mdc) | Always — product, stack, boundaries                    |
| [common.mdc](.cursor/rules/common.mdc)                     | Always — naming, style, security baseline              |
| [tdd.mdc](.cursor/rules/tdd.mdc)                           | Always — TDD default                                   |
| [git-commit.mdc](.cursor/rules/git-commit.mdc)             | Always — commit process/safety (format via commitlint) |
| [backend.mdc](.cursor/rules/backend.mdc)                   | `apps/api/**`                                          |
| [frontend.mdc](.cursor/rules/frontend.mdc)                 | `apps/web/**`                                          |
| [packages.mdc](.cursor/rules/packages.mdc)                 | `packages/**`                                          |

## Language

- **Conversation**: Chinese (中文)
- **Documentation / comments / commits / code identifiers**: English

## Project quick info

**Elynd** — AI-assisted English learning platform (graded reading, TTS listen-and-read, instant dictionary, article AI Q&A).

**Stack**

- API: NestJS + Better Auth (cookie session) + Drizzle + PostgreSQL + optional Redis reserved (port **3336**)
- Web: Next.js App Router + React + TanStack Query/Form + Tailwind CSS v4 (port **3000**)
- Shared: `@elynd/db`, `@elynd/auth`, `@elynd/shared` (`shared` must not depend on `db`)
- Tooling: root `tsconfig.base.json`, `prettier.config.js`, `eslint.config.mjs` (Nest/Next TS options in each app)
- Package manager: pnpm workspace (`apps/*`, `packages/*`)

## Legacy code

Former AdonisJS `backend/` and Vue `web/` were removed. Recover via `backup/pre-v2` / `main` (e.g. `git diff backup/pre-v2 -- backend web`).

## Common commands

**Do not** run `pnpm run dev:*`, `start`, or `preview` unless the user explicitly asks.

```bash
pnpm compose:init   # copy docker-compose.yaml.example → docker-compose.yaml
pnpm run dev:api    # API (3336)
pnpm run dev:web    # Web (3000)
pnpm run lint
pnpm run format:check
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run db:push
```

## External docs

- [NestJS](https://docs.nestjs.com)
- [Better Auth](https://www.better-auth.com/docs)
- [Next.js](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [TanStack Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)
