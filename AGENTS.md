# AGENTS.md

Guidance for AI coding assistants in the Elynd repository.

## Rules source of truth

[`.cursor/rules/`](.cursor/rules/). Project rules win over Cursor User Rules on conflict.

### Precedence

1. Tooling (ESLint, Prettier, typecheck, tests)
2. Always-on: `core`, `layering`, `structure`
3. Glob: `backend` / `frontend` / `packages`
4. Agent playbooks (e.g. `create-api-feature`)
5. Current Trellis task + **filled** `.trellis/spec` contracts
6. Skills / MCP
7. User Rules

### Index

| Rule                                                           | When                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| [core.mdc](.cursor/rules/core.mdc)                             | Always — principles, Must/Ask/Never, TDD, DoD, router        |
| [layering.mdc](.cursor/rules/layering.mdc)                     | Always — package graph, concern placement, cross-layer order |
| [structure.mdc](.cursor/rules/structure.mdc)                   | Always — create/delete/split/move files & dirs               |
| [backend.mdc](.cursor/rules/backend.mdc)                       | `apps/api/**`                                                |
| [frontend.mdc](.cursor/rules/frontend.mdc)                     | `apps/web/**`                                                |
| [packages.mdc](.cursor/rules/packages.mdc)                     | `packages/**`                                                |
| [create-api-feature.mdc](.cursor/rules/create-api-feature.mdc) | New API domain feature / Nest module                         |

## Language

- Conversation: Chinese (中文)
- Documentation / comments / commits / code identifiers: English

## Common commands

**Do not** run `pnpm run dev:*`, `start`, or `preview` unless the user explicitly asks.

```bash
pnpm compose:init   # docker-compose.yaml.example → docker-compose.yaml
pnpm run dev:api    # API :3336
pnpm run dev:web    # Web :3000
pnpm run lint
pnpm run format:check
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run db:push
```

## External docs

- [NestJS](https://docs.nestjs.com) · [Better Auth](https://www.better-auth.com/docs) · [Next.js](https://nextjs.org/docs) · [Drizzle](https://orm.drizzle.team/docs/overview) · [TanStack Query](https://tanstack.com/query/latest) · [Tailwind CSS](https://tailwindcss.com/docs)
