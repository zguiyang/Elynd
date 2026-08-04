# AGENTS.md

Guidance for AI coding assistants working in the Elynd repository (Cursor).

## Rules Entry

Behavioral guidelines (think / simplify / surgical edits / verifiable goals) live in **Cursor User Rules** (Customize → Rules) and apply across all projects.

Project rules live in **`.cursor/rules/`** (Cursor `.mdc` rules). When they conflict with User Rules, **project rules win**.

| Rule                                                       | When                                |
| ---------------------------------------------------------- | ----------------------------------- |
| [project-overview.mdc](.cursor/rules/project-overview.mdc) | Always — product, stack, boundaries |
| [common.mdc](.cursor/rules/common.mdc)                     | Always — naming, style, constants   |
| [backend.mdc](.cursor/rules/backend.mdc)                   | `apps/api/**`                       |
| [frontend.mdc](.cursor/rules/frontend.mdc)                 | `apps/web/**`                       |
| [packages.mdc](.cursor/rules/packages.mdc)                 | `packages/**`                       |
| [git-commit.mdc](.cursor/rules/git-commit.mdc)             | Always — commits                    |
| [tdd.mdc](.cursor/rules/tdd.mdc)                           | Always — TDD default                |

## Language

- **Conversation**: Chinese (中文)
- **Documentation / comments / commits / code identifiers**: English

## Project Quick Info

**Elynd** — AI-assisted English learning platform (graded reading, TTS listen-and-read, instant dictionary, article AI Q&A).

**Stack**

- API: NestJS + Better Auth (Bearer) + Drizzle + PostgreSQL + Redis (port **3336**)
- Web: Next.js App Router + React + TanStack Query/Form + Zustand + Tailwind CSS v4 (port **3000**)
- Shared: `@elynd/db`, `@elynd/shared`, `@elynd/tsconfig`, `@elynd/eslint-config`, `@elynd/prettier-config`
- Package manager: pnpm workspace (`apps/*`, `packages/*`)

## Legacy code

Former AdonisJS `backend/` and Vue `web/` were removed. Recover via `backup/pre-v2` / `main` (e.g. `git diff backup/pre-v2 -- backend web`).

## Common Commands

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

## External Docs

- [NestJS](https://docs.nestjs.com)
- [Better Auth](https://www.better-auth.com/docs)
- [Next.js](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [TanStack Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)
