# AGENTS.md

Guidance for AI coding assistants in the Elynd repository.

## Product intent (read before feature work)

Canonical product docs (English): [`docs/product/`](docs/product/).

| Doc                                                                                | Use                          |
| ---------------------------------------------------------------------------------- | ---------------------------- |
| [`docs/product/README.md`](docs/product/README.md)                                 | Index / read order           |
| [`docs/product/product-vision.md`](docs/product/product-vision.md)                 | What Elynd is / is not       |
| [`docs/product/learning-philosophy.md`](docs/product/learning-philosophy.md)       | Learning science stance      |
| [`docs/product/mvp-scope.md`](docs/product/mvp-scope.md)                           | MVP, non-goals, module map   |
| [`docs/product/content-strategy.md`](docs/product/content-strategy.md)             | Curated library, admin flow  |
| [`docs/product/success-metrics.md`](docs/product/success-metrics.md)               | North star and drift metrics |
| [`docs/product/feature-decision-guide.md`](docs/product/feature-decision-guide.md) | Should we build this?        |
| [`docs/product/design-guardrails.md`](docs/product/design-guardrails.md)           | Anti-drift review            |

HTML prototypes: [`prd/`](prd/) (references only).

**One-liner:** Elynd is an English learning space for adults who struggle to persist—interesting, mostly understandable real content (read + listen), with tools (including AI) that lower friction. Not a course, vocab pack, or chatbot.

## Visual design (UI)

Agent-facing design system SSOT: [`DESIGN.md`](DESIGN.md) (repo root).

- **Before** generating or restyling UI in `apps/web`, read `DESIGN.md` and follow its tokens, usage rules, and Do's / Don'ts.
- Implement appearance via CSS variables / semantic utilities in `apps/web/app/globals.css` — do not hardcode theme colors in feature code.
- `prd/` shows screen intent and elements; **`DESIGN.md` wins** for color, type, shape, and elevation.
- Product philosophy / anti-drift (non-visual): [`docs/product/`](docs/product/) — especially [`design-guardrails.md`](docs/product/design-guardrails.md).

## Rules source of truth

[`.cursor/rules/`](.cursor/rules/). Project rules win over Cursor User Rules on conflict.

### Precedence

1. Tooling (ESLint, Prettier, typecheck, tests)
2. Always-on: `core`, `layering`, `structure`
3. Glob: `adonis-backend` / `frontend` / `packages`
4. **[`DESIGN.md`](DESIGN.md)** for visual / UI appearance (when touching `apps/web` UI)
5. Project skills + MCP
6. Current Trellis task + **filled** `.trellis/spec` contracts
7. **Filled** [`docs/product/`](docs/product/) for product-scope decisions
8. User Rules

### Index

| Rule                                                   | When                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| [core.mdc](.cursor/rules/core.mdc)                     | Always — principles, Must/Ask/Never, TDD, DoD, router        |
| [layering.mdc](.cursor/rules/layering.mdc)             | Always — package graph, concern placement, cross-layer order |
| [structure.mdc](.cursor/rules/structure.mdc)           | Always — create/delete/split/move files & dirs               |
| [adonis-backend.mdc](.cursor/rules/adonis-backend.mdc) | `apps/backend/**` (Adonis API)                               |
| [frontend.mdc](.cursor/rules/frontend.mdc)             | `apps/web/**`                                                |
| [packages.mdc](.cursor/rules/packages.mdc)             | `packages/**`                                                |

## Language

- Conversation with the user: Chinese (中文) when the user writes Chinese
- **Documentation** (including `docs/`, README product sections, comments): **English**
- Commits / code identifiers: English

## Common commands

**Do not** run `pnpm run dev:*`, `start`, or `preview` unless the user explicitly asks.

```bash
pnpm compose:init      # docker-compose.yaml.example → docker-compose.yaml
pnpm run dev:backend   # Adonis API :3333
pnpm run dev:web       # Web :3000
pnpm run lint
pnpm run format:check
pnpm run typecheck
pnpm run test
pnpm run build
# DB migrations: cd apps/backend && node ace migration:run
```

## External docs

- [AdonisJS](https://docs.adonisjs.com) · [Adonis folder structure](https://docs.adonisjs.com/guides/getting-started/folder-structure) · [Next.js](https://nextjs.org/docs) · [TanStack Query](https://tanstack.com/query/latest) · [Tailwind CSS](https://tailwindcss.com/docs)
