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

**UI rule stack:** apply the global **Instruction authority** below. For the path-specific project-rule level, the UI order is **`DESIGN.md`** → [`.cursor/rules/frontend.mdc`](.cursor/rules/frontend.mdc) → the selected Gloaming-owned/project Skill → the selected third-party Skill → shadcn or other component defaults. UI simplification must **not** infer product behavior (auto-save, automatic fetch, implicit confirm, etc.). Security, authorization, and user-consent boundaries cannot be bypassed; tooling checks provide verification, not product semantics.

- **Before** generating or restyling UI in `apps/web`, read `DESIGN.md` (including **Interaction philosophy**) and [`.cursor/rules/frontend.mdc`](.cursor/rules/frontend.mdc) UI design judgment + Anti-Redundancy Checklist + **Behavior boundary**.
- Implement appearance via CSS variables / semantic utilities in `apps/web/app/globals.css` — do not hardcode theme colors in feature code.
- Screen flows: [`docs/product/prototype-flows.md`](docs/product/prototype-flows.md). Visual tokens: **`DESIGN.md`**. Visual polish: the selected Design Skill — it does **not** replace interaction rules or override admin/reader scope in `DESIGN.md` / `frontend.mdc`.
- Product philosophy / anti-drift (non-visual): [`docs/product/`](docs/product/) — especially [`design-guardrails.md`](docs/product/design-guardrails.md).

### Design Skill contract

For UI work, agents must read the relevant `DESIGN.md` and product/flow sections first; they must not load the complete Design Skill collection by default. Apply the global instruction authority and the UI rule stack above; do not create a separate priority system for visual work.

Design Skills may provide visual, layout, motion, image, or aesthetic methods only. They must not change information architecture, persistence, request timing, confirmation, auto-save, automatic navigation, or other product behavior. When a Skill conflicts with project rules, adapt or omit its recommendation and report the decision; never change the project design system to accommodate it. Select Skills by task relevance instead of loading all of them together.

## Rules source of truth

[`.cursor/rules/`](.cursor/rules/) holds Cursor-specific and path-scoped rule bodies. `AGENTS.md` holds cross-agent hard constraints, routing, and minimal shared contracts; it does not duplicate Cursor-specific implementation detail.

### Skill lifecycle

- Third-party project Skills are managed by the Skills CLI, with their sources recorded in `skills-lock.json`.
- Use `npx skills list` for inventory when needed.
- Install, update, and remove third-party Skills only with the corresponding `npx skills` command; updates and removals require explicit user authorization.
- Treat `npx skills check` as a potentially networked or locally mutating check; obtain user authorization before running it. It is not an ordinary side-effect-free status check.
- Gloaming-owned Skills are authoritative in repository Git, are not recorded in `skills-lock.json`, and are not managed by `npx skills update/remove`.
- Global Skills stay outside the project directory and project lockfile.

### Loading

| Mode                                   | Rules                                                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Always-on                              | `core`, `ponytail`, `layering`, `structure`, `testing-database-safety`, `infrastructure-operations`, `codebase-exploration`                         |
| Glob (when matching paths are in play) | `backend` (`apps/backend/**`), `frontend` (`apps/web/**`), `packages` (`packages/**`)                                                               |
| On demand                              | Select a matching project/Gloaming-owned Skill or third-party Skill by description; use official docs or MCP for current/external facts when needed |

### Instruction authority

Use this order to decide what should be done, whether it is allowed, and how to resolve an instruction conflict:

1. Non-bypassable system, security, permission, and user-authorization boundaries.
2. The user’s explicit goal, scope, and limits.
3. Locked task behavior and the product/domain contracts in [`docs/product/`](docs/product/) and [`docs/adr/`](docs/adr/).
4. `AGENTS.md` and `core` cross-agent hard constraints.
5. Applicable path rules; for UI, use `DESIGN.md` then `frontend.mdc`.
6. Gloaming-owned project Skills.
7. The selected third-party Skill.
8. Generic component defaults, general best practices, and Agent assumptions.

An explicit user request may change an ordinary product preference, but it cannot bypass security, permission, or explicit authorization boundaries. If it conflicts with locked task behavior or a product/domain contract, report the conflict and obtain an explicit decision rather than silently choosing a side. If rules conflict with code reality, report the mismatch; do not silently select the rules or the code.

Design Skills, third-party Skills, and component defaults may provide visual or implementation guidance, but may not change product behavior or the project design system.

### Facts and verification sources

Use these sources to decide whether something is true or whether the implementation passes:

- Code, configuration, migrations, tests, and runtime state are the primary evidence.
- Lint, formatting, type checks, tests, and builds are verification mechanisms; they do not decide product semantics.
- MCP, official documentation, and Skills may provide current facts, external material, or operational guidance, but cannot override project contracts.
- GitNexus is graph navigation and impact analysis; verify its conclusions against source.
- When verification fails, fix it, report it, or ask the user to decide. Never use instruction priority to bypass a failed check.

### Index

| Rule                                                                         | Load              | Role                                                             |
| ---------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------- |
| [core.mdc](.cursor/rules/core.mdc)                                           | Always            | Constitution, gate, Ask/Never, TDD, DoD, router                  |
| [ponytail.mdc](.cursor/rules/ponytail.mdc)                                   | Always            | Lazy-senior ladder before writing code                           |
| [layering.mdc](.cursor/rules/layering.mdc)                                   | Always            | Package graph, concern placement, cross-layer order              |
| [structure.mdc](.cursor/rules/structure.mdc)                                 | Always            | Structural hard boundaries + `repository-structure` routing      |
| [testing-database-safety.mdc](.cursor/rules/testing-database-safety.mdc)     | Always            | Test database hard boundaries + `test-database-workflow` routing |
| [infrastructure-operations.mdc](.cursor/rules/infrastructure-operations.mdc) | Always            | Env/infra discovery — config first, runtime when needed          |
| [codebase-exploration.mdc](.cursor/rules/codebase-exploration.mdc)           | Always            | Prefer GitNexus for cross-module explore/impact; verify src      |
| [backend.mdc](.cursor/rules/backend.mdc)                                     | `apps/backend/**` | Hono API conventions                                             |
| [frontend.mdc](.cursor/rules/frontend.mdc)                                   | `apps/web/**`     | Next.js / UI; feature page composition (anti–god component)      |
| [packages.mdc](.cursor/rules/packages.mdc)                                   | `packages/**`     | Shared package conventions                                       |

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

This project may be indexed by GitNexus as **gloaming-reader**. An index is a navigation aid, not source truth; do not assume it is current or available.

GitNexus capabilities are separate: an installed Skill provides guidance, while MCP and CLI availability determines whether graph operations can actually run. Do not infer executable GitNexus access from a Skill, an index, or a configuration file. Do not rebuild or bootstrap an index automatically; if the index or tool is unavailable or stale, report that condition and use the restricted fallback below.

## Always Do

- **MUST run impact before changing a named function, class, method, or other code symbol when GitNexus MCP or CLI is available.** Use `impact({target: "symbolName", direction: "upstream"})` or the equivalent CLI operation; report callers, processes, and risk. Never substitute grep for an available graph analysis.
- **MUST analyze graph changes before committing when GitNexus MCP or CLI is available.** Use `detect_changes({scope: "all"})` (MCP) or the equivalent CLI operation. `partial: true` or `truncated: true` is not a clean check — unseen results are not evidence of no impact. For regression review, use the compare scope against the target base ref.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **When GitNexus is unavailable, stale, or cannot resolve the target, the Agent MUST state the reason and analysis limitation.** A restricted fallback is allowed: source search, call-site review, relevant tests, and an explicit manual impact statement. The fallback MUST NOT be reported as “no impact” and MUST NOT skip validation.
- When GitNexus is available, use its query/context/impact operations for callers, dependencies, imports, and execution flows; verify important conclusions against source. For security review, use the available taint-analysis operation when supported.

## Never Do

- NEVER edit a function, class, or method before available MCP/CLI impact analysis; if unavailable, disclose the restricted fallback and its limitations.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before available MCP/CLI graph change analysis; if unavailable, disclose that the graph check could not be performed and record the fallback validation.

## Resources

| Resource                                         | Use for                                  |
| ------------------------------------------------ | ---------------------------------------- |
| `gitnexus://repo/gloaming-reader/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/gloaming-reader/clusters`       | All functional areas                     |
| `gitnexus://repo/gloaming-reader/processes`      | All execution flows                      |
| `gitnexus://repo/gloaming-reader/process/{name}` | Step-by-step execution trace             |

## Skill guidance

When an installed GitNexus Skill is available, load the matching exploration, impact-analysis, debugging, refactoring, guide, or CLI guidance before using that workflow. Skill guidance does not prove that GitNexus MCP or CLI is executable in the current Agent environment, and these rules never require a local Skill path to exist.

<!-- gitnexus:end -->
