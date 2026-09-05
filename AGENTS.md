# AGENTS.md

Guidance for AI coding assistants in the Gloaming repository.

## Product intent (read before feature work)

Canonical product docs (English): [`docs/product/`](docs/product/).

| Doc                                                                                            | Use                                                        |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`docs/adr/001-reading-content-domain-model.md`](docs/adr/001-reading-content-domain-model.md) | **Domain SSOT** — ReadingWork, Part, State, Asset          |
| [`docs/product/README.md`](docs/product/README.md)                                             | Index / read order                                         |
| [`docs/product/product-vision.md`](docs/product/product-vision.md)                             | What Gloaming is / is not; personas; experience references |
| [`docs/product/product-principles.md`](docs/product/product-principles.md)                     | Reading-first decision rules                               |
| [`docs/product/mvp-scope.md`](docs/product/mvp-scope.md)                                       | V1 capability must / must-not                              |
| [`docs/product/mvp-1-modules.md`](docs/product/mvp-1-modules.md)                               | **MVP 1 module roadmap** (prototype / build anti-drift)    |
| [`docs/product/roadmap.md`](docs/product/roadmap.md)                                           | Phase 1–3 outcomes; Phase 1a vs 1b                         |
| [`docs/product/feature-audit.md`](docs/product/feature-audit.md)                               | KEEP / hide / migrate existing code                        |
| [`docs/product/learning-philosophy.md`](docs/product/learning-philosophy.md)                   | Why authentic reading                                      |
| [`docs/product/content-strategy.md`](docs/product/content-strategy.md)                         | ReadingWork supply; admin EPUB (MVP); user import (1b)     |
| [`docs/product/engineering-vocabulary.md`](docs/product/engineering-vocabulary.md)             | Product vs engineering naming; target APIs                 |
| [`docs/product/prototype-flows.md`](docs/product/prototype-flows.md)                           | First-time + daily reading loop                            |
| [`docs/product/success-metrics.md`](docs/product/success-metrics.md)                           | North star and drift metrics                               |
| [`docs/product/feature-decision-guide.md`](docs/product/feature-decision-guide.md)             | Should we build this?                                      |
| [`docs/product/design-guardrails.md`](docs/product/design-guardrails.md)                       | Anti-drift review                                          |

**One-liner:** Gloaming is an AI Native Language Reading Environment—read authentic English like a modern ebook reader, with contextual AI when you get stuck. Not a course, not drills, not a chatbot. The core is helping people keep reading English they actually want to read.

## Domain model rules

The content domain is **ReadingWork-based** (ADR-001). Read [`docs/adr/001-reading-content-domain-model.md`](docs/adr/001-reading-content-domain-model.md) and [`docs/product/engineering-vocabulary.md`](docs/product/engineering-vocabulary.md) before schema or API work.

**Do not introduce:**

- `Article` as the content root (legacy — Phase 3 removes it)
- `reading_progress`, `article_audio` (use **ReadingState**, **ContentAsset**)
- Lesson / course / Learn* product entities
- Short Article Library as product identity
- Article compatibility aliases or dual models

**Use:**

- **ReadingWork** — catalog / shelf / conversation root (no body)
- **ReadingPart** — Reader, TTS, Translate, Assist text boundary
- **ReadingState** — shelf membership + position
- **ContentAsset** — EPUB file, TTS audio, cover, derivatives
- **Conversation** with `subject_type = reading_work`

**MVP supply:** `admin_epub` (primary). **`admin_text`** = internal dev/test fallback only — not product.

Shipped code may still use legacy Article names until **Phase 3** migration — do not extend the Article model; implement toward target names in docs.

## Visual design (UI)

Agent-facing design system SSOT: [`DESIGN.md`](DESIGN.md) (repo root) — visual tokens **and** interaction philosophy (information economy, compression, admin density, **UI vs product behavior**).

**UI rule stack:** locked task brief + [`docs/product/`](docs/product/) (persistence, fetch, confirm, side effects) → **`DESIGN.md`** → [`.cursor/rules/frontend.mdc`](.cursor/rules/frontend.mdc) → Taste skills (visual polish only) → shadcn defaults last. UI simplification must **not** infer product behavior (auto-save, automatic fetch, implicit confirm, etc.).

- **Before** generating or restyling UI in `apps/web`, read `DESIGN.md` (including **Interaction philosophy**) and [`.cursor/rules/frontend.mdc`](.cursor/rules/frontend.mdc) UI design judgment + Anti-Redundancy Checklist + **Behavior boundary**.
- Implement appearance via CSS variables / semantic utilities in `apps/web/app/globals.css` — do not hardcode theme colors in feature code.
- Screen flows: [`docs/product/prototype-flows.md`](docs/product/prototype-flows.md). Visual tokens: **`DESIGN.md`**. Visual polish: Taste skills — they do **not** replace interaction rules or override admin/reader scope in `DESIGN.md` / `frontend.mdc`.
- Product philosophy / anti-drift (non-visual): [`docs/product/`](docs/product/) — especially [`design-guardrails.md`](docs/product/design-guardrails.md).

## Rules source of truth

[`.cursor/rules/`](.cursor/rules/). Bodies live only in those files — this index does not restate them.

### Loading

| Mode                                   | Rules                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Always-on                              | `core`, `ponytail`, `layering`, `structure`, `testing-database-safety`, `infrastructure-operations`, `codebase-exploration` |
| Glob (when matching paths are in play) | `backend` (`apps/backend/**`), `frontend` (`apps/web/**`), `packages` (`packages/**`)                                       |
| On demand                              | Project skills (by description) → MCP if skills insufficient                                                                |

### Precedence (first wins on conflict)

1. Tooling (ESLint, Prettier, typecheck, tests)
2. `core` — Ask/Never, decision gate, TDD, security, DoD
3. `ponytail` — coding minimalism / ladder
4. `layering` — where a concern belongs
5. `structure` — create/delete/split/move files
6. `infrastructure-operations` — env/infra discovery and ops methodology (defers to `core` / `testing-database-safety` for policy)
7. `codebase-exploration` — when to prefer GitNexus; graph is navigation aid, source is SoT
8. Glob rule for the touched app/package
9. **[`DESIGN.md`](DESIGN.md)** for visual / UI appearance (`apps/web` UI)
10. Project skills
11. MCP (docs / live systems)
12. **Filled** [`docs/product/`](docs/product/) for product-scope decisions
13. User Rules

### Index

| Rule                                                                         | Load              | Role                                                        |
| ---------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| [core.mdc](.cursor/rules/core.mdc)                                           | Always            | Constitution, gate, Ask/Never, TDD, DoD, router             |
| [ponytail.mdc](.cursor/rules/ponytail.mdc)                                   | Always            | Lazy-senior ladder before writing code                      |
| [layering.mdc](.cursor/rules/layering.mdc)                                   | Always            | Package graph, concern placement, cross-layer order         |
| [structure.mdc](.cursor/rules/structure.mdc)                                 | Always            | File/dir create/delete/split/move; feature UI size ceiling  |
| [testing-database-safety.mdc](.cursor/rules/testing-database-safety.mdc)     | Always            | Test DB isolation; AI agent pre-test checks                 |
| [infrastructure-operations.mdc](.cursor/rules/infrastructure-operations.mdc) | Always            | Env/infra discovery — config first, runtime when needed     |
| [codebase-exploration.mdc](.cursor/rules/codebase-exploration.mdc)           | Always            | Prefer GitNexus for cross-module explore/impact; verify src |
| [backend.mdc](.cursor/rules/backend.mdc)                                     | `apps/backend/**` | Hono API conventions                                        |
| [frontend.mdc](.cursor/rules/frontend.mdc)                                   | `apps/web/**`     | Next.js / UI; feature page composition (anti–god component) |
| [packages.mdc](.cursor/rules/packages.mdc)                                   | `packages/**`     | Shared package conventions                                  |

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
pnpm db:migrate:test   # migrate gloaming_test (after cp apps/backend/.env.test.example → .env.test)
pnpm run build
pnpm db:generate       # Drizzle generate (@gloaming/db)
pnpm db:migrate        # Drizzle migrate
```

## External docs

- [Hono](https://hono.dev/) · [Better Auth](https://www.better-auth.com/) · [Drizzle](https://orm.drizzle.team/) · [Next.js](https://nextjs.org/docs) · [TanStack Query](https://tanstack.com/query/latest) · [Tailwind CSS](https://tailwindcss.com/docs)

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **gloaming-reader** (7038 symbols, 16544 relationships, 408 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource                                         | Use for                                  |
| ------------------------------------------------ | ---------------------------------------- |
| `gitnexus://repo/gloaming-reader/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/gloaming-reader/clusters`       | All functional areas                     |
| `gitnexus://repo/gloaming-reader/processes`      | All execution flows                      |
| `gitnexus://repo/gloaming-reader/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                               |
| -------------------------------------------- | -------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
