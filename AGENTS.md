# AGENTS.md

This document provides guidance for AI coding assistants working in this codebase.

## Rules Entry

Project rules have been migrated to `.agents/rules/`, which is the primary location for rule documentation.

Before code changes, feature implementation, refactoring, testing, or code generation, read the relevant files in `.agents/rules/` based on task type.

## Language Convention

**Conversation Language**: All conversations and responses must be in Chinese (中文)

**Documentation Language**: All documentation, code comments, and technical content must be in English

## Project Quick Info

**Project Name**: Elynd - AI-Powered English Learning Platform

**Features**: Graded Reading, Listen & Read (TTS), Instant Dictionary, AI Q&A, Access Token Authentication

**Tech Stack**:
- Backend: AdonisJS 7.x + PostgreSQL + Lucid ORM
- Frontend: Vue 3 + Vite + Vue Router + Pinia + shadcn-vue + Reka UI + Tailwind CSS v4
- Package Manager: pnpm workspace

## Documentation Index

### Development Guides (`.agents/rules/`)

- **[00-overview.md](.agents/rules/00-overview.md)** - Project overview, architecture, directory structure
- **[01-common.md](.agents/rules/01-common.md)** - Naming conventions, code style, quality checks, boundary rules
- **[02-backend.md](.agents/rules/02-backend.md)** - Backend development (AdonisJS)
- **[03-frontend.md](.agents/rules/03-frontend.md)** - Frontend development (Vue 3 + shadcn-vue)
- **[04-git-commit.md](.agents/rules/04-git-commit.md)** - Git commit message rules, commit boundaries, verification, and remote safety

### OpenSpec Workflow

- **[openspec/AGENTS.md](openspec/AGENTS.md)** - Change proposal process and workflow

## Common Commands

**IMPORTANT**: Do NOT run any development/startup server commands (`pnpm run dev:*`, `pnpm run start`, `pnpm run preview`, etc.) without explicit user instruction or confirmation. This prevents conflicts with services the user may already have running.

### Development

```bash
pnpm run dev:backend    # Backend server (port 3335)
pnpm run dev:web       # Frontend server (port 3000)
```

### Code Quality

```bash
pnpm run lint           # Lint both backend and web
pnpm run typecheck      # Type check both
pnpm run test           # Run backend tests
```

### Build

```bash
pnpm run build          # Build both
pnpm run start          # Start backend production
pnpm run preview        # Preview frontend build
```

## Available Skills

### Core Framework Skills

- **[adonisjs](.opencode/skills/adonisjs/)** - AdonisJS development including routing, controllers, models, middleware, authentication, database operations with Lucid ORM, validation, testing, and Ace CLI commands

- **[vue-best-practices](.opencode/skills/vue-best-practices/)** - Vue 3 development with Composition API, best practices, and patterns

- **[shadcn-vue](.opencode/skills/shadcn-vue/)** - shadcn-vue component library for Vue 3 with Reka UI and Tailwind CSS v4. **Use MCP server when skill is insufficient**: `npx shadcn-vue@latest mcp init --client opencode`

- **[vue-router-best-practices](.opencode/skills/vue-router-best-practices/)** - Vue Router 4 patterns, navigation guards, route params

- **[pinia](.opencode/skills/pinia/)** - Pinia state management for Vue 3

- **[vite](.opencode/skills/vite/)** - Vite build tool configuration and plugins

- **[antfu](.opencode/skills/antfu/)** - Anthony Fu's opinionated tooling and conventions for JavaScript/TypeScript projects. Use for code organization, ESLint configuration, pnpm workflows, and Vue/Nuxt conventions

### Tailwind CSS Skills (MUST USE)

- **[tailwindcss](.opencode/skills/tailwindcss/)** - **MUST USE** - Tailwind CSS v4 utility-first framework (v4.1.18). Contains complete documentation including:
  - Installation and configuration
  - Utility classes and theme variables
  - Responsive design and variants
  - Layout, typography, visual styles
  - Migration guide from v3 to v4
  - **Use for**: All Tailwind CSS styling tasks, theme customization, responsive designs

- **[tailwindcss-advanced-layouts](.opencode/skills/tailwindcss-advanced-layouts/)** - **MUST USE** - Advanced Tailwind CSS layout techniques:
  - Complex Grid layouts (Holy Grail, auto-fill, subgrid)
  - Advanced Flexbox patterns (space distribution, flexible sizing)
  - Container queries (responsive components)
  - Positioning and layering (sticky, fixed, z-index management)
  - Overflow and scrolling (custom scrollbars, scroll snap)
  - Aspect ratio and object fit
  - Multi-column layouts
  - Print styles
  - **Use for**: Complex layout requirements, grid systems, responsive components

**Tailwind CSS Skill Usage Workflow**:

```bash
# When working on Tailwind CSS styling:
1. Always consult tailwindcss skill first (v4 syntax, utilities, theme)
2. For complex layouts (grids, flexbox patterns), use tailwindcss-advanced-layouts
3. For shadcn-vue components, use shadcn-vue skill
4. Cross-reference between skills as needed
```

**When to Use Each Skill**:

| Scenario | Primary Skill | Secondary Skills |
|----------|---------------|------------------|
| Basic styling (colors, spacing, typography) | tailwindcss | - |
| Theme customization (colors, fonts, spacing) | tailwindcss | - |
| Responsive design (breakpoints, variants) | tailwindcss | - |
| Grid layouts (2D layouts) | tailwindcss-advanced-layouts | tailwindcss |
| Flexbox patterns (1D layouts, alignment) | tailwindcss-advanced-layouts | tailwindcss |
| Container queries (component-level responsive) | tailwindcss-advanced-layouts | tailwindcss |
| Complex positioning (sticky, fixed, layering) | tailwindcss-advanced-layouts | tailwindcss |
| shadcn-vue components | shadcn-vue | tailwindcss, tailwindcss-advanced-layouts |

### Frontend Styling Skills

- **[ui-ux-pro-max](.opencode/skills/ui-ux-pro-max/)** - UI/UX design intelligence with extensive design systems, component patterns, color palettes, typography pairings, and style guidance

### Type System Skills

- **[typescript-advanced-types](.opencode/skills/typescript-advanced-types/)** - TypeScript advanced types including generics, conditional types, mapped types, template literals, and utility types for type-safe applications

### Product Management Skills

- **[product-manager-toolkit](.opencode/skills/product-manager-toolkit/)** - Product management tools including RICE prioritization, customer interview analysis, PRD templates, discovery frameworks, and go-to-market strategies

## AI Code Generation System Prompt

When generating code for this project, AI assistants MUST follow these rules:

### Component Usage Priority
1. **MUST** query shadcn-vue skill for component patterns first
2. **MUST** use shadcn-vue components if available
3. **MAY** compose shadcn-vue components for complex features
4. **ONLY** implement custom components when shadcn-vue cannot meet requirement

### Component Naming Convention
- **Files**: kebab-case (e.g., `bookmark-card.vue`, `user-profile.vue`)
- **Components**: PascalCase (e.g., `BookmarkCard`, `UserProfile`)
- **NO EXCEPTIONS**

### Workflow for Generating UI Code

#### Step 1: Identify UI Elements
List all UI elements needed (buttons, inputs, modals, cards, etc.)

#### Step 2: Check shadcn-vue Components
Use **shadcn-vue skill** to check available components:
- Form components: Form, Input, Textarea, Select, Checkbox, Switch
- Feedback: Toast, Alert, Badge
- Overlay: Dialog, Sheet, Popover, DropdownMenu
- Data Display: Table, Tabs, Separator, Avatar
- Navigation: NavigationMenu, Command

#### Step 3: Install Required Components
```bash
pnpm dlx shadcn-vue@latest add <component-name>
```

#### Step 4: Implement Using shadcn-vue
Follow patterns from shadcn-vue skill for:
- Form validation with vee-validate + zod
- Data tables
- Navigation patterns

#### Step 5: Custom Component (Last Resort)
ONLY create custom components when:
- shadcn-vue does not have equivalent component
- shadcn-vue component cannot meet specific requirements

#### Tools Integration Summary
| Tool | Purpose | When to Use |
|------|---------|-------------|
| shadcn-vue skill | Component patterns, recipes | First step for any UI element |
| vue-router-best-practices skill | File-based routing | Route creation |
| pinia skill | State management | Application state |
| axios skill | HTTP client, interceptors | API configuration |
| Custom implementation | Only when shadcn-vue insufficient | Last resort |

**CRITICAL**: ALWAYS use shadcn-vue skill - it provides:
- Component installation commands
- Common gotchas and workarounds
- Complete recipe patterns

## External Resources

- **AdonisJS**: https://docs.adonisjs.com
- **Vue**: https://vuejs.org
- **shadcn-vue**: https://shadcn-vue.com
- **Vue Router**: https://router.vuejs.org
- **Pinia**: https://pinia.vuejs.org
- **Tailwind CSS**: https://tailwindcss.com/docs
