---
version: alpha
name: Elynd
description: >-
  Calm editorial product UI for an English reading space —
  warm paper surfaces, single brand ember accent, light theme only.
colors:
  canvas: '#FAF9F6'
  paper: '#F3EEE2'
  sidebar: '#FCFBF8'
  ink: '#1C1917'
  surface: '#FFFFFF'
  brand: '#C2410C'
  brand-soft: '#FFF7ED'
  brand-deep: '#9A3412'
  muted-foreground: '#57534E'
  border: '#E7E5E4'
  primary: '{colors.brand}'
  secondary: '{colors.paper}'
  accent: '{colors.brand-soft}'
  accent-foreground: '{colors.brand-deep}'
  background: '{colors.canvas}'
  foreground: '{colors.ink}'
  card: '{colors.surface}'
  destructive: '#DC2626'
typography:
  body:
    fontFamily: Source Sans 3, Noto Sans SC, ui-sans-serif, system-ui, sans-serif
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  heading:
    fontFamily: Source Serif 4, Noto Serif SC, ui-serif, Georgia, serif
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.02em
  label:
    fontFamily: Source Sans 3, Noto Sans SC, ui-sans-serif, system-ui, sans-serif
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
  eyebrow:
    fontFamily: Source Sans 3, Noto Sans SC, ui-sans-serif, system-ui, sans-serif
    fontSize: 0.875rem
    fontWeight: 500
    letterSpacing: 0.16em
rounded:
  control: 0.8rem
  panel: 1.75rem
  app-cta: 0.75rem
  full: 9999px
omitted:
  - section: spacing
    reason: Spacing scale not frozen yet; refine when Auth/Dashboard UI is implemented.
  - section: components
    reason: Component token map deferred until UI screens are designed against this system.
---

# Elynd Design System

Agent-facing visual identity. Normative values live in the YAML front matter; prose below explains character and usage. Implement in `apps/web` via CSS variables / shadcn semantic tokens — do not hardcode hex in feature UI.

**Status:** Partial v1 (light theme foundations). Expand as screens are designed.

**Related:** `prd/` prototypes (visual reference) · `docs/product/` (product philosophy, not visual tokens)

---

## Overview

Elynd is a **calm editorial product shell** — a quiet paper reading room for adults who struggle to persist with English. The UI should feel warm, dry, and low-pressure: somewhere you can sit and read for a few minutes without being pushed, scored, or entertained into anxiety.

**Character**

- Indie and human, not platform marketing
- Editorial / manuscript-adjacent, never luxury fashion or SaaS cockpit
- Restrained warmth: one ember accent as bookmark/firelight, not a dyed page
- Adult-to-adult tone; no shame, streak theater, or gamified noise

**User feeling to protect**

> “It’s quiet here. I can read a little. Help is there if I need it.”

**Design language family:** Calm Editorial Product (paper surfaces + clear type hierarchy + scarce accent + minimal motion). Borrow Apple-like product restraint (clarity, whitespace, little decoration) — not Apple marketing spectacle, not Awwwards choreography, not cold Linear tooling chrome.

**Theme scope:** Light only. Dark / “night reading” is deferred; do not invent a dark palette until that experience is designed.

---

## Colors

Palette is warm neutrals plus a **single** brand accent.

| Token      | Hex       | Role                                                         |
| ---------- | --------- | ------------------------------------------------------------ |
| Canvas     | `#FAF9F6` | Page background (`background`)                               |
| Paper      | `#F3EEE2` | Warm panels / secondary surfaces (`secondary`, `paper`)      |
| Sidebar    | `#FCFBF8` | App sidebar wash (subtle lift from canvas)                   |
| Ink        | `#1C1917` | Primary text (`foreground`)                                  |
| Surface    | `#FFFFFF` | Cards, auth form panels (`card`)                             |
| Brand      | `#C2410C` | Primary actions and scarce emphasis (`primary`)              |
| Brand soft | `#FFF7ED` | Small accent washes only (`accent`)                          |
| Brand deep | `#9A3412` | Hover / deeper emphasis (`accent-foreground`, primary hover) |
| Muted text | `#57534E` | Secondary copy (`muted-foreground`)                          |
| Border     | `#E7E5E4` | Hairlines, input borders                                     |

**Usage rules**

- **Primary / brand** = the one important action per region, current nav, progress fills, occasional eyebrow — not every link or icon.
- **Brand soft** = small areas only (selected nav chip, logo mark background). Never large section fills.
- **Large warm fields** = `paper` / `secondary`, never brand-soft.
- Do not introduce a fourth warm gray (e.g. prototype `#EEE8DC`) or a second accent hue.
- Map into existing shadcn semantics (`background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `card`, `border`, `ring`, `sidebar-*`) when implementing `globals.css`.

---

## Typography

Two roles only:

- **UI / body / labels / buttons:** Source Sans 3 + Noto Sans SC (never Inter).
- **Display titles and English article titles:** Source Serif 4 + Noto Serif SC. Serif is for headings and book titles only — not form labels, nav, or buttons.

Eyebrow labels (e.g. auth “登录”) may use sans with wide tracking and brand color; prefer plain text, not pill badges.

Exact type scale (px per level) is not frozen yet — keep hierarchy clear and calm; refine while building screens.

---

## Layout

Not a full spacing scale yet. When building:

- Prefer generous breathing room over dense dashboards.
- Auth: comfortable page margins; form column ~26rem max width (per prototype intent).
- Dashboard: fixed sidebar + spacious main padding; section gaps clearly larger than in-card gaps.
- Collapse multi-column layouts to a single column below ~768px.

---

## Elevation & Depth

Hierarchy comes mainly from **tonal layers** (canvas → paper → white surface), not heavy drop shadows.

- Prefer a hairline ring (`foreground` at ~5% / `border`) over shadow.
- If a shadow is needed (e.g. auth card), keep it soft, short, and low opacity — never Tailwind default `shadow-md` / `lg` / `xl`.
- Optional global paper grain: fixed, non-interactive overlay at ~3% opacity (prototype texture). Do not animate it.

---

## Shapes

- **Control radius base:** ~`0.8rem` (inputs, compact controls). Softer than sharp utilitarian UI; not toy-round.
- **Large panels / auth form shell:** ~`1.75rem` / `rounded-3xl`-class softness.
- **Auth primary CTA:** `rounded-full` (pill) — intentional entry ritual.
- **In-app primary CTA:** `rounded-xl` (≈ `app-cta`) — not pills.
- Do not use agency “double-bezel” nested card shells as a default pattern.

---

## Do's and Don'ts

**Do**

- Read this file before generating or restyling UI.
- Express color through semantic tokens / CSS variables, not raw hex in features.
- Keep one accent; keep motion nearly invisible (short color transitions; optional light `active:scale` on primary CTA).
- Match Auth ↔ App shape rules above.
- Preserve low-pressure copy and quiet composition when inventing system UI copy and layout.
- Keep **system UI language Chinese** (labels, nav, empty states, toasts, placeholders) until product i18n is an explicit decision; learning content / operator-typed field values may be English or Chinese.

**Don't**

- Don’t ship Inter, Roboto, or generic “AI purple / neon glass” looks.
- Don’t use brand/primary as the default color for all interactive text.
- Don’t fill large regions with brand-soft or saturated orange.
- Don’t add heavy shadows, glow, mesh gradients, floating island nav, or cinematic scroll theater.
- Don’t implement dark mode values until a night-reading theme is explicitly designed.
- Don’t treat `prd/` HTML as pixel law — it defines elements and intent; layout may be refined, tokens in this file win for color/type/shape.
- Don’t invent a second Admin color theme — same tokens; denser workbench layout is OK.

**UI composition:** Prefer shadcn atoms, then Tailwind polish, then limited native markup — aesthetics over atom purity. Ladder and Base UI gotchas: `.cursor/rules/frontend.mdc`.
