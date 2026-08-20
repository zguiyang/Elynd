# AGENTS.md

Guidance for AI coding assistants in the Gloaming repository.

## Product intent (read before feature work)

Canonical product docs (English): [`docs/product/`](docs/product/).

| Doc                                                                                | Use                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`docs/product/README.md`](docs/product/README.md)                                 | Index / read order                                         |
| [`docs/product/product-vision.md`](docs/product/product-vision.md)                 | What Gloaming is / is not; personas; experience references |
| [`docs/product/product-principles.md`](docs/product/product-principles.md)         | Reading-first decision rules                               |
| [`docs/product/mvp-scope.md`](docs/product/mvp-scope.md)                           | V1 capability must / must-not                              |
| [`docs/product/mvp-1-modules.md`](docs/product/mvp-1-modules.md)                   | **MVP 1 module roadmap** (prototype / build anti-drift)    |
| [`docs/product/roadmap.md`](docs/product/roadmap.md)                               | Phase 1–3 outcomes; Phase 1a vs 1b                         |
| [`docs/product/feature-audit.md`](docs/product/feature-audit.md)                   | KEEP / hide / migrate existing code                        |
| [`docs/product/learning-philosophy.md`](docs/product/learning-philosophy.md)       | Why authentic reading                                      |
| [`docs/product/content-strategy.md`](docs/product/content-strategy.md)             | Import-first supply                                        |
| [`docs/product/prototype-flows.md`](docs/product/prototype-flows.md)               | First-time + daily reading loop                            |
| [`docs/product/success-metrics.md`](docs/product/success-metrics.md)               | North star and drift metrics                               |
| [`docs/product/feature-decision-guide.md`](docs/product/feature-decision-guide.md) | Should we build this?                                      |
| [`docs/product/design-guardrails.md`](docs/product/design-guardrails.md)           | Anti-drift review                                          |

**One-liner:** Gloaming is an AI Native Language Reading Environment—read authentic English like a modern ebook reader, with contextual AI when you get stuck. Not a course, not drills, not a chatbot. The core is helping people keep reading English they actually want to read.

## Visual design (UI)

Agent-facing design system SSOT: [`DESIGN.md`](DESIGN.md) (repo root).

- **Before** generating or restyling UI in `apps/web`, read `DESIGN.md` and follow its tokens, usage rules, and Do's / Don'ts.
- Implement appearance via CSS variables / semantic utilities in `apps/web/app/globals.css` — do not hardcode theme colors in feature code.
- Screen flows: [`docs/product/prototype-flows.md`](docs/product/prototype-flows.md). Visual tokens: **`DESIGN.md`**.
- Product philosophy / anti-drift (non-visual): [`docs/product/`](docs/product/) — especially [`design-guardrails.md`](docs/product/design-guardrails.md).

## Rules source of truth

[`.cursor/rules/`](.cursor/rules/). Bodies live only in those files — this index does not restate them.

### Loading

| Mode                                   | Rules                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| Always-on                              | `core`, `ponytail`, `layering`, `structure`                                           |
| Glob (when matching paths are in play) | `backend` (`apps/backend/**`), `frontend` (`apps/web/**`), `packages` (`packages/**`) |
| On demand                              | Project skills (by description) → MCP if skills insufficient                          |

### Precedence (first wins on conflict)

1. Tooling (ESLint, Prettier, typecheck, tests)
2. `core` — Ask/Never, decision gate, TDD, security, DoD
3. `ponytail` — coding minimalism / ladder
4. `layering` — where a concern belongs
5. `structure` — create/delete/split/move files
6. Glob rule for the touched app/package
7. **[`DESIGN.md`](DESIGN.md)** for visual / UI appearance (`apps/web` UI)
8. Project skills
9. MCP (docs / live systems)
10. **Filled** [`docs/product/`](docs/product/) for product-scope decisions
11. User Rules

### Index

| Rule                                         | Load              | Role                                                        |
| -------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| [core.mdc](.cursor/rules/core.mdc)           | Always            | Constitution, gate, Ask/Never, TDD, DoD, router             |
| [ponytail.mdc](.cursor/rules/ponytail.mdc)   | Always            | Lazy-senior ladder before writing code                      |
| [layering.mdc](.cursor/rules/layering.mdc)   | Always            | Package graph, concern placement, cross-layer order         |
| [structure.mdc](.cursor/rules/structure.mdc) | Always            | File/dir create/delete/split/move; feature UI size ceiling  |
| [backend.mdc](.cursor/rules/backend.mdc)     | `apps/backend/**` | Hono API conventions                                        |
| [frontend.mdc](.cursor/rules/frontend.mdc)   | `apps/web/**`     | Next.js / UI; feature page composition (anti–god component) |
| [packages.mdc](.cursor/rules/packages.mdc)   | `packages/**`     | Shared package conventions                                  |

## Language

- Conversation: Chinese when the user writes Chinese
- Plans (generate / present / review with the user): Chinese
- Code comments, identifiers, commits: English
- Repo docs (`docs/`, README): English by default; follow the user's language when they specify one

## Common commands

**Do not** run `pnpm run dev:*`, `start`, or `preview` unless the user explicitly asks.

```bash
pnpm compose:init      # docker-compose.yaml.example → docker-compose.yaml
pnpm run dev:backend   # Hono API :3333
pnpm run dev:web       # Web :3000
pnpm run lint
pnpm run format:check
pnpm run typecheck
pnpm run test
pnpm run build
pnpm db:generate       # Drizzle generate (@gloaming/db)
pnpm db:migrate        # Drizzle migrate
```

## External docs

- [Hono](https://hono.dev/) · [Better Auth](https://www.better-auth.com/) · [Drizzle](https://orm.drizzle.team/) · [Next.js](https://nextjs.org/docs) · [TanStack Query](https://tanstack.com/query/latest) · [Tailwind CSS](https://tailwindcss.com/docs)
