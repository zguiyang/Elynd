---
version: mvp-screens
name: Gloaming
description: >-
  Calm Paper-First editorial UI for an English reading environment —
  warm peach surfaces, single burnt-orange accent, light theme only.
  Token SSOT aligned with MVP Stitch screens (temp/gloaming).
colors:
  surface: '#fff8f5'
  surface-dim: '#e0d8d5'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#faf2ee'
  surface-container: '#f4ece8'
  surface-container-high: '#eee7e3'
  surface-container-highest: '#e9e1dd'
  surface-variant: '#e9e1dd'
  on-surface: '#1e1b19'
  on-surface-variant: '#59413a'
  inverse-surface: '#33302d'
  inverse-on-surface: '#f7efeb'
  outline: '#8d7168'
  outline-variant: '#e1bfb5'
  surface-tint: '#ac3400'
  primary: '#9b2f00'
  on-primary: '#ffffff'
  primary-container: '#c2410c'
  on-primary-container: '#ffece7'
  inverse-primary: '#ffb59d'
  secondary: '#615e55'
  on-secondary: '#ffffff'
  secondary-container: '#e7e2d6'
  on-secondary-container: '#67645b'
  tertiary: '#545553'
  on-tertiary: '#ffffff'
  tertiary-container: '#6c6d6b'
  on-tertiary-container: '#f1f0ed'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59d'
  on-primary-fixed: '#390c00'
  on-primary-fixed-variant: '#832600'
  secondary-fixed: '#e7e2d6'
  secondary-fixed-dim: '#cac6bb'
  on-secondary-fixed: '#1d1c15'
  on-secondary-fixed-variant: '#49473e'
  tertiary-fixed: '#e3e2e0'
  tertiary-fixed-dim: '#c7c6c4'
  on-tertiary-fixed: '#1a1c1a'
  on-tertiary-fixed-variant: '#464745'
  background: '#fff8f5'
  on-background: '#1e1b19'
  # App / shadcn semantic aliases (implemented in apps/web/app/globals.css)
  paper: '{colors.secondary-container}'
  brand: '{colors.primary-container}'
  brand-deep: '{colors.primary}'
  brand-soft: '{colors.primary-fixed}'
  canvas: '{colors.background}'
  ink: '{colors.on-surface}'
  muted-foreground: '{colors.on-surface-variant}'
  border: '{colors.outline-variant}'
  shadcn-primary: '{colors.primary-container}'
  shadcn-secondary: '{colors.secondary-container}'
  accent: '{colors.primary-fixed}'
  accent-foreground: '{colors.primary}'
  card: '{colors.surface-container-lowest}'
  destructive: '{colors.error}'
typography:
  display-editorial:
    fontFamily: Source Serif 4, Noto Serif SC, serif
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Source Serif 4, Noto Serif SC, serif
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Source Serif 4, Noto Serif SC, serif
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Source Serif 4, Noto Serif SC, serif
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-reading:
    fontFamily: Source Serif 4, Noto Serif SC, serif
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 36px
    letterSpacing: 0.01em
  body-ui:
    fontFamily: Source Sans 3, Noto Sans SC, sans-serif
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-ui-sm:
    fontFamily: Source Sans 3, Noto Sans SC, sans-serif
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Source Sans 3, Noto Sans SC, sans-serif
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-ui:
    fontFamily: Source Sans 3, Noto Sans SC, sans-serif
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
  # App conventions
  control: 0.75rem
  panel: 1rem
  app-cta: 0.75rem
  auth-cta: 9999px
spacing:
  reading-column: 680px
  gutter: 2rem
  margin-mobile: 1.5rem
  stack-lg: 4rem
  stack-md: 2rem
  stack-sm: 1rem
  # Page chrome: Tailwind `container` (responsive; xl/2xl ceilings in globals.css).
  container-xl: 1200px
  container-2xl: 1480px
---

# Gloaming Design System

Agent-facing visual identity. **Normative values live in the YAML front matter**; prose below explains character and usage. Implement in `apps/web` via CSS variables / shadcn semantic tokens in [`apps/web/app/globals.css`](apps/web/app/globals.css) — **do not hardcode hex in feature or component UI**.

**Status:** MVP screen-aligned foundations (light theme). Source screens: Stitch MVP set under `temp/` (local only).

**Related:** `docs/product/` (product philosophy + screen flows, not visual tokens) · interaction references: Apple Books, TextStack, Readest — [`docs/product/product-vision.md`](docs/product/product-vision.md) §8 (borrow patterns; `DESIGN.md` still wins on color, type, shape).

---

## Overview

Gloaming is a **Paper-First, Modern Editorial** reading environment. The UI should feel like a premium hardcover or literary journal: warm, quiet, and low-pressure — somewhere you come back to a book, not to a learning task.

**Character**

- Quietness: whitespace reduces cognitive load while reading authentic English
- Tactility: hierarchy from paper tone shifts, not heavy shadows
- Focus: chrome stays secondary to text until needed
- One burnt-orange ember accent — bookmark/firelight, never a dyed page
- Adult-to-adult tone; no shame, streak theater, or gamified noise

**User feeling to protect**

> “It’s quiet here. I can read a little. Help is there if I need it.”

**Theme scope:** Light only. Dark / “night reading” is deferred; do not invent a dark palette until that experience is designed.

---

## Colors

Warm peach neutrals plus a **single** burnt-orange accent family.

| Token                               | Hex                   | Role                                         |
| ----------------------------------- | --------------------- | -------------------------------------------- |
| Background / Surface                | `#fff8f5`             | App page wash (`background`, `surface`)      |
| Surface container low → high        | `#faf2ee` … `#eee7e3` | Tonal panels, chips, docks                   |
| Surface container lowest            | `#ffffff`             | Cards, popovers, overlays (`card`)           |
| Surface container highest / variant | `#e9e1dd`             | Stronger fills, progress tracks              |
| On-surface                          | `#1e1b19`             | Primary text (`foreground`)                  |
| On-surface-variant                  | `#59413a`             | Secondary copy (`muted-foreground`)          |
| Primary (deep)                      | `#9b2f00`             | Hover / deeper emphasis (`brand-deep`)       |
| Primary container                   | `#c2410c`             | Filled CTA / shadcn `primary`                |
| On-primary-container                | `#ffece7`             | Text on filled CTA when needed               |
| Primary fixed                       | `#ffdbd0`             | Small accent washes (`accent`, `brand-soft`) |
| Secondary container                 | `#e7e2d6`             | Warm paper panels (`secondary`, `paper`)     |
| Outline                             | `#8d7168`             | Stronger structural lines                    |
| Outline variant                     | `#e1bfb5`             | Default hairlines / inputs (`border`)        |
| Error                               | `#ba1a1a`             | Destructive (`destructive`)                  |

**Usage rules**

- **Primary container** = the one important action per region, current nav fills, progress fills — not every link or icon.
- **Primary fixed / brand-soft** = small areas only (selected nav chip, logo mark). Never large section fills.
- **Large warm fields** = `secondary-container` / `paper` / `surface-container-*`, never primary-fixed.
- One accent hue only; no fourth competing warm gray invented ad hoc in feature CSS.
- Hex literals belong **only** in `DESIGN.md` YAML and `:root` primitives in `globals.css`. Everywhere else: semantic Tailwind classes or `var(--…)`.

### Token → shadcn / Tailwind map

| Design token                             | CSS / Tailwind                                            |
| ---------------------------------------- | --------------------------------------------------------- |
| `background`                             | `--background` / `bg-background`                          |
| `on-surface` / `on-background`           | `--foreground` / `text-foreground`                        |
| `primary-container`                      | `--primary` / `bg-primary` (button fill)                  |
| `primary`                                | `--brand-deep` / `text-brand-deep`, `hover:bg-brand-deep` |
| `primary-fixed`                          | `--accent` / `bg-accent`, `--brand-soft`                  |
| `on-primary`                             | `--primary-foreground`                                    |
| `secondary-container`                    | `--secondary` / `bg-secondary`, `--paper` / `bg-paper`    |
| `surface-container-lowest`               | `--card` / `bg-card`                                      |
| `surface-container` (+ low/high/highest) | `--surface-container*` / `bg-surface-container*`          |
| `on-surface-variant`                     | `--muted-foreground`                                      |
| `surface-container` (muted wash)         | `--muted` / `bg-muted`                                    |
| `outline-variant`                        | `--border` / `border-border`                              |
| `outline`                                | `--outline` / `border-outline` (stronger)                 |
| `error`                                  | `--destructive`                                           |
| `surface-tint`                           | hover deepen alternative (`--surface-tint`)               |

Compat aliases (`--canvas`, `--ink`, `--brand`, `--border-warm`, …) resolve to the tokens above so existing `bg-paper` / `text-brand-deep` classes keep working without hex.

---

## Typography

Functional split between **Editorial Serif** and **Interface Sans** (never Inter / Roboto).

- **Serif (Source Serif 4 + Noto Serif SC):** display, headlines, book titles, long-form reading (`body-reading`).
- **Sans (Source Sans 3 + Noto Sans SC):** nav, settings, buttons, tooltips, dense UI (`body-ui`, `label-ui`, `label-caps`).
  - **Primary site-nav destinations** use **`body-ui` (16px)** — see Site nav contract.
  - **`label-ui` (14px)** is for denser / secondary chrome only (footer links, compact controls), not top-nav destinations.
- Use `label-caps` for meta like chapter or level labels.
- Load via `@fontsource-variable` in `apps/web` (`--font-ui`, `--font-display`, `--font-reading` in `globals.css`). Reader body uses `--font-reading` and does not inherit UI sans.
- Exact scales are frozen in the YAML front matter.

---

## Layout & Spacing

Classical book rhythm: centered content, generous negative space.

- **Page chrome (`container`):** Use Tailwind’s `container` class for landing, app shell, and future marketing/product pages (centered + gutters in `apps/web/app/globals.css`). Do **not** hardcode a fixed `1024px` shell — Stitch / temp prototypes use 1024 as an artboard, not a product lock. Breakpoint ceilings: default through `lg` → **`xl` 1200px** → **`2xl` 1480px** (comfortable on 2K / 3K). Long-form text still nests in the reading column.
- **Reading column:** Nest `max-w-reading-column` / `--reading-column` (~`680px`) inside `container` for long-form text (~50–75 characters). Grids and multi-column UI may use the full container width.
- **Full-bleed:** Backgrounds / hero photography span the viewport; inner content stays in `container`.
- **Rhythm:** 8px-based; prefer `stack-sm` / `stack-md` / `stack-lg` (1 / 2 / 4rem) over dense dashboard packing.
- **Gutters:** Mobile ≈ `1.5rem` (`margin-mobile`); `md+` ≈ `2rem` (`gutter`) — baked into `container`, avoid stacking extra `px-*` on the same node.
- Collapse multi-column layouts below ~768px.

---

## Elevation & Depth

Depth from **tonal layering** and hairline outlines — not heavy drop shadows.

- **Level 0:** `background` `#fff8f5`
- **Level 1:** warm paper (`secondary-container` / surface-container ladder)
- **Level 2:** white overlays (`surface-container-lowest`) with soft diffused shadow ≈ `0 4px 20px` at ~5–10% `on-surface`, plus subtle border
- Hover: darken border / tonal step — do not escalate to Tailwind `shadow-md` / `lg` / `xl`
- Optional global paper grain: fixed, non-interactive, ~3% opacity; do not animate

---

## Shapes

- **Controls / in-app CTA:** `rounded-xl` ≈ `0.75rem` (`md` / `control` / `app-cta`)
- **Cards / main blocks:** `rounded-2xl` ≈ `1rem` (`lg` / `panel`)
- **Selection / compact:** `0.5rem` (`DEFAULT`)
- **Auth primary CTA:** `rounded-full` (pill) — intentional entry ritual
- Soft organic corners; no agency “double-bezel” nested card shells as default

---

## Components (visual contracts)

- **Primary button:** `bg-primary` (`primary-container`), white label; hover → `brand-deep` / `primary`. No gradients.
- **Secondary / ghost:** transparent + `border-border` (outline-variant); neutral text.
- **Reading / shelf cards:** warm `bg-paper` or `bg-surface-container-*`, `rounded-2xl`, prefer tonal edge over heavy border.
- **Translation / help popovers:** `bg-card`, `rounded-xl`, hairline border; serif for lemma, sans for notes.
- **Chips:** `rounded-full`, `bg-brand-soft` / `bg-accent`, deep accent text — small only.
- **Sidebar active:** soft accent wash + thin primary bar on the leading edge. (Legacy; learner chrome uses **Site nav** below.)
- **Site nav (top chrome) — locked:** Shared header for landing + learner pages. Implement via `SiteNav` + `@utility site-nav-link` in `globals.css`; do not restyle ad hoc per page.
  - **Brand lockup:** mark + serif wordmark `Gloaming` (`BrandMark` `appearance="editorial"`).
  - **Primary links:** `body-ui` scale — **16px / 24 line-height**, weight **500** idle → **700** active. Not `label-ui` (14px); that token is for denser chrome (footer, meta, compact controls).
  - **Idle color:** `muted-foreground` / on-surface-variant; **hover / active:** `primary` (ember).
  - **Active indicator:** **2px** bottom underline in `primary`, with **4px** gap under the glyphs (`padding-bottom: 0.25rem`). Every link keeps a transparent 2px underline slot so the row does not jump. Do not use 1px hairlines for nav active — too weak on 2K/3K next to the 36px avatar.
  - **Row:** desktop height **64–80px**; link cluster `gap-8`; trailing Search (placeholder) + **36px** avatar when signed in, or Sign In text when guest.
  - **Settings:** same link typography; opens account menu (no Settings product page in MVP 1).
  - Temp Stitch HTML may disagree (14px / 1px underline on some screens) — **this contract wins**.

---

## Do's and Don'ts

**Do**

- Read this file before generating or restyling UI.
- Express color only through semantic tokens / CSS variables (`bg-primary`, `text-muted-foreground`, `var(--surface-container)`, …).
- Keep one accent; motion nearly invisible (short color transitions; optional light `active:scale` on primary CTA).
- Keep **system UI language Chinese** (labels, nav, empty states, toasts, placeholders) until product i18n is explicit; learning content may be EN/ZH.
- For reader chrome, shelf, and discover flows, borrow interaction from Apple Books / TextStack / Readest — not their visuals or study features (e.g. SRS).

**Don't**

- Don’t hardcode hex (or one-off `rgb()`/`oklch()` palettes) in `features/**` or `components/**` except via theme variables.
- Don’t ship Inter, Roboto, or generic “AI purple / neon glass” looks.
- Don’t use primary/brand as the default color for all interactive text.
- Don’t fill large regions with brand-soft / primary-fixed or saturated orange.
- Don’t add heavy shadows, glow, mesh gradients, floating island nav, or cinematic scroll theater.
- Don’t implement dark mode values until a night-reading theme is explicitly designed.
- Don’t invent a parallel token set in feature CSS — extend this file / `globals.css` first.
- Don’t invent a second Admin color theme — same tokens; denser workbench layout is OK.

**UI composition:** Prefer shadcn atoms, then Tailwind polish, then limited native markup — aesthetics over atom purity. Ladder and Base UI gotchas: `.cursor/rules/frontend.mdc`.
