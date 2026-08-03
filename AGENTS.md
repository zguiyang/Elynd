# AGENTS.md

Guidance for AI coding assistants working in the Elynd repository (Cursor).

## Rules Entry

Project rules live in **`.cursor/rules/`** (Cursor `.mdc` rules). Read the relevant rule before implementing features, refactors, or tests.

| Rule | When |
|------|------|
| [project-overview.mdc](.cursor/rules/project-overview.mdc) | Always — product, stack, boundaries |
| [common.mdc](.cursor/rules/common.mdc) | Always — naming, style, constants |
| [backend.mdc](.cursor/rules/backend.mdc) | `backend/**` |
| [frontend.mdc](.cursor/rules/frontend.mdc) | `web/**` |
| [git-commit.mdc](.cursor/rules/git-commit.mdc) | Always — commits |
| [tdd.mdc](.cursor/rules/tdd.mdc) | Always — TDD default |

## Language

- **Conversation**: Chinese (中文)
- **Documentation / comments / commits / code identifiers**: English

## Project Quick Info

**Elynd** — AI-assisted English learning platform (graded reading, TTS listen-and-read, instant dictionary, article AI Q&A).

**Stack**

- Backend: AdonisJS 7 + PostgreSQL + Lucid + Redis, Access Token auth (port **3335**)
- Frontend: Vue 3 + Vite + Pinia + Vue Router + shadcn-vue + Tailwind CSS v4 (port **3000**)
- Package manager: pnpm workspace

## MCP

Project MCP config: [`.mcp.json`](.mcp.json) (shadcn-vue MCP). Keep using it for component discovery when helpful. Prefer Context7 / official docs for library APIs.

## Common Commands

**Do not** run `pnpm run dev:*`, `start`, or `preview` unless the user explicitly asks.

```bash
pnpm run dev:backend    # Backend (3335)
pnpm run dev:web        # Frontend (3000)
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## External Docs

- [AdonisJS](https://docs.adonisjs.com)
- [Vue](https://vuejs.org)
- [shadcn-vue](https://shadcn-vue.com)
- [Vue Router](https://router.vuejs.org)
- [Pinia](https://pinia.vuejs.org)
- [Tailwind CSS](https://tailwindcss.com/docs)
