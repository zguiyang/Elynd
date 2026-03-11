# Common Rules

This document applies to both backend and frontend development in the Elynd project.

## Naming Conventions

| Type | File Name | Component Name |
|------|-----------|----------------|
| Backend Controller | `kebab-case` + `_controller.ts` (e.g., `auth_controller.ts`) | N/A |
| Backend Validator | `kebab-case` + `_validator.ts` (e.g., `auth_validator.ts`) | N/A |
| Backend Service | PascalCase + `.ts` (e.g., `AuthService.ts`) | N/A |
| Backend Middleware | `kebab-case` + `_middleware.ts` (e.g., `auth_middleware.ts`) | N/A |
| Views/Layouts | `kebab-case` (e.g., `sign-in.vue`, `auth-layout.vue`) | `PascalCase` (e.g., `SignIn`, `AuthLayout`) |
| Shared components | `PascalCase` (e.g., `BookmarkCard.vue`) | `PascalCase` (e.g., `BookmarkCard`) |
| shadcn-vue components | `PascalCase` (e.g., `Button.vue`) | `PascalCase` (e.g., `Button`) |

- **Class/Interface names**: `PascalCase` (e.g., `UserController`, `AuthService`)
- **Function/Variable names**: `camelCase` (e.g., `getUserData`, `isAuthenticated`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)

### ⚠️ Backend Validator Naming (CRITICAL)

**Validators MUST follow this naming pattern**: `{name}_validator.ts`

| Wrong (Do NOT use) | Correct |
|---------------------|---------|
| `change_password.ts` | `change_password_validator.ts` |
| `user_config.ts` | `user_config_validator.ts` |
| `system_config.ts` | `system_config_validator.ts` |
| `article_chat.ts` | `article_chat_validator.ts` |
| `ai.ts` | `ai_validator.ts` |

### ⚠️ Services vs Utils

**Services** MUST be classes with `@inject()` decorator:
```typescript
@inject()
export class AuthService {
  // ✅ Correct: Business logic class
}
```

**Utils** should be simple functions/values:
```typescript
// ✅ Correct: Utility functions
export function speechSdkTicksToMs(ticks: number): number { ... }
export const SOME_CONSTANT = 'value'
```

**DO NOT** put utils in services directory:
```typescript
// ❌ Wrong: Utility file in services
// app/services/speech_sdk_time.ts (just exports functions)

// ✅ Correct: Move to utils
// app/utils/speech_sdk_time.ts
```

## Code Style

### Formatting

- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Line width**: 100 characters
- **Semicolons**: No semicolons
- **Trailing commas**: No trailing commas

### TypeScript

- **Explicit type imports**: `import type { NextFn } from '@adonisjs/core/types/http'`
- **Optional types**: Use `| null` instead of `undefined`
- **Type safety**: Avoid `any`, prefer `unknown` or specific types
- **Advanced types**: For complex type logic, generics, conditional types, mapped types, and utility types, consult [typescript-advanced-types](.opencode/skills/typescript-advanced-types/) skill

### Constants

**Why Constants**

- Avoid hardcoded values scattered across the codebase
- Centralize management for easy maintenance
- Provide type safety with TypeScript inference
- Improve readability with semantic naming

**Definition Pattern**

```typescript
// app/constants/index.ts
const ORDER_BY = {
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
  TITLE: 'title',
} as const

type OrderBy = (typeof ORDER_BY)[keyof typeof ORDER_BY]

export { ORDER_BY }
export type { OrderBy }
```

**Usage**

```typescript
import { ORDER_BY, type OrderBy } from '~/constants'

const getList = (orderBy: OrderBy = ORDER_BY.CREATED_AT) => {
  // IDE auto-complete, type-safe
}
```

**When to Define Constants (MUST)**

| Category | Example | Required |
|----------|---------|----------|
| Status values | `BOOKMARK_STATUS.ACTIVE`, `ORDER_STATUS.PENDING` | ✅ Required |
| Types/Classification | `MEMO_VISIBILITY.PUBLIC`, `CONTENT_TYPE.ARTICLE` | ✅ Required |
| Mode/Method | `SORT_ORDER.ASC`, `FETCH_MODE.LAZY` | ✅ Required |
| API parameters | `ORDER_BY.CREATED_AT`, `SORT_BY.TITLE` | ✅ Required |
| Literal used ≥2 times | `type === 'bookmark'` → `CONTENT_TYPE.BOOKMARK` | ✅ Required |
| UI display text | Button labels, messages | Recommended |
| Business rules | Limits, thresholds | Recommended |
| Local temporary | Single-use values | ❌ Not needed |

**Forbidden Practices**

```typescript
// ❌ Forbidden: hardcoded
if (status === 'active') { ... }
router.get('/users?sort_by=created_at')

// ❌ Forbidden: use enum
enum Status { ... }

// ❌ Forbidden: scattered definitions
const STATUS_ACTIVE = 'active'  // In another file
if (status === STATUS_ACTIVE) { ... }
```

**File Organization: Constants Summary File**

The `constants/index.ts` file is a **summary file for all constants** in the project. All types of constants should be organized in this single file by module, following the KISS principle.

**Key Principle**
- All constants belong in one summary file
- Organize by module/category within the file
- Avoid splitting into multiple small files (one variable per file)
- Only split when the file exceeds 500 lines

**Correct Approach**
```typescript
// constants/index.ts
// All constants organized by module in a single file

// Order related
const ORDER_BY = {
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
  TITLE: 'title',
} as const

// Pagination related
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_SIZE: 20,
  MAX_SIZE: 100,
} as const

// Status related
const BOOKMARK_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const

// Validation related
const VALIDATION = {
  TITLE_MIN: 1,
  TITLE_MAX: 200,
  CONTENT_MAX: 50000,
} as const

export { ORDER_BY, PAGINATION, BOOKMARK_STATUS, VALIDATION }
export type { OrderBy, Pagination, BookmarkStatus, Validation }
```

**Wrong Approach (Avoid)**
```typescript
// ❌ Splitting by type into multiple files
// constants/order_by.ts
const ORDER_BY = { ... }
export { ORDER_BY }

// constants/pagination.ts
const PAGINATION = { ... }
export { PAGINATION }

// constants/status.ts
const BOOKMARK_STATUS = { ... }
export { BOOKMARK_STATUS }
```

**When to Split**
- File exceeds 500 lines
- Multiple completely unrelated constants mixed together
- Team collaboration conflicts due to file size

**Directory Structure**

```
app/
├── constants/           # Summary file for all frontend constants
│   └── index.ts         # Contains all constants (ORDER_BY, PAGINATION, STATUS, VALIDATION, ...)
```

```
backend/
app/
├── constants/          # Summary file for all backend constants
│   └── index.ts        # Contains all constants (ORDER_BY, PAGINATION, STATUS, VALIDATION, ...)
```

### React Components

- Use functional components with TypeScript
- Use shadcn/ui components for UI elements
- All components use explicit imports

## Quality Checks

### Before Committing

Always run these commands before committing changes:

```bash
pnpm run lint        # Lint both backend and web
pnpm run typecheck    # Type check both backend and web
```

### Linting

- **Backend**: `pnpm --filter backend lint`
- **Frontend**: `pnpm --filter web lint`
- **Both**: `pnpm run lint`

Auto-fix issues:
```bash
pnpm --filter backend lint --fix
pnpm --filter web lint --fix
```

### Type Checking

- **Backend**: `pnpm --filter backend typecheck` (runs `tsc --noEmit`)
- **Frontend**: `pnpm --filter web typecheck` (runs `tsc --noEmit`)
- **Both**: `pnpm run typecheck`

All `.ts` files must pass without errors before committing.

### Testing

- **Backend**: `pnpm --filter backend test` (runs Japa tests)

## Boundary Rules

### ✅ Must Do

- Prefer using `node ace make:*` commands to create backend files, then manually modify
- Create migration files before modifying database structure
- Run `pnpm run lint` and `pnpm run typecheck` before committing
- Follow adonisjs skill guidance for all AdonisJS development
- Follow shadcn-ui skill guidance for React UI components
- Follow tanstack-router skill guidance for React routing

### ⚠️ Ask First

- Modifying authentication method or adding new authentication providers
- Adding new dependencies or updating framework versions
- Major database structure changes (affecting existing data)

### 🚫 Never Do

- Commit secrets (keys, passwords, etc.) to the code repository
- Modify `node_modules/` directories
- Delete data or directly operate on production database
- Disable framework middleware or security mechanisms
- Run development server commands (`pnpm run dev:*`, `pnpm run start`, etc.) without explicit user instruction or confirmation

## External Documentation References

### AdonisJS Documentation

- **Commands and usage**: Use adonisjs skill or visit https://docs.adonisjs.com
- **Routing**: Refer to `basics.md` in adonisjs skill
- **Database migrations**: Refer to `database.md` in adonisjs skill
- **Testing**: Refer to `testing.md` in adonisjs skill

### React + TanStack Router Documentation

- **Official docs**: https://react.dev
- Use tanstack-router skill for file-based routing patterns
- Routes: `web/src/routes/`
- Route configuration: `web/src/router.tsx`

### shadcn/ui Components

- **Official docs**: https://ui.shadcn.com
- Use shadcn-ui skill for component patterns and installation
- Components are located in `web/src/components/ui/`

### Configuration Files

- **Path aliases**:
  - Backend: See `imports` in `backend/package.json`
  - Frontend: See `vite.config.ts` and `tsconfig.json`
- **Environment variables**:
  - Root: `.env.example`
  - Backend: `backend/.env.example`
  - Frontend: `web/.env.example`
- **Database connection**: See `backend/config/database.ts`

## File Organization Best Practices

### General Principles

**KISS Principle**: Keep It Simple, Stupid. Prioritize simplicity over premature abstraction.

**Rules**

| Scenario | Action |
|----------|--------|
| Business not complex | Keep related code in **single file** |
| Code ≤ 500 lines | Keep single file, no splitting needed |
| Code > 500 lines | Consider splitting, but first check if can simplify |
| Business grows large | Refactor and split when maintaining becomes difficult |

**Splitting Threshold**: 500 lines

**File Organization Examples**

```typescript
// ✅ Recommended: Keep in single file when ≤500 lines
// validators/auth_validator.ts
export const loginValidator = vine.compile(...)
export const registerValidator = vine.compile(...)
export const resetPasswordValidator = vine.compile(...)
export type { LoginValidator, RegisterValidator, ResetPasswordValidator }
```

```typescript
// ❌ Opposed: Over-splitting (when business is not complex)
// validators/login_validator.ts
export const loginValidator = vine.compile(...)
export type { LoginValidator }

// validators/register_validator.ts
export const registerValidator = vine.compile(...)
export type { RegisterValidator }
```

**When to Refactor/Split**

- Single file exceeds 500 lines
- Multiple completely unrelated functions mixed together
- Frequent team collaboration conflicts
- Test cases are difficult to organize

**Keep files focused and small (max 300 lines when possible)**
**Use descriptive names that clearly indicate purpose**
**Group related functionality in directories**
**Follow framework-specific conventions**

### Backend (AdonisJS)

- Controllers: Handle HTTP requests, delegate to services
- Services: Contain business logic
- Models: Define data structure and relationships
- Validators: Validate request input (VineJS)
- Middleware: Cross-cutting concerns (auth, logging)

### Frontend (React)

- Pages: Route components with TanStack Router
- Components: Reusable UI elements (shadcn/ui + custom)
- Hooks: Custom React hooks for shared logic
- API modules: Axios instance with interceptors (`lib/api.ts`)
- Query: TanStack Query for data fetching and caching
- Router: Type-safe routing with TanStack Router

## Skill Usage Guide

Skills provide specialized knowledge and step-by-step guidance for specific technical domains. This section explains when and how to use each skill effectively.

### Purpose of Skills

Skills are comprehensive references that contain:
- Framework-specific patterns and conventions
- Best practices and common pitfalls
- Code examples and implementation guidance
- Configuration and usage patterns

Consult skills when:
- Working with a specific framework or library
- Implementing patterns you are unfamiliar with
- Seeking best practices for a technical domain
- Debugging framework-specific issues

### Skill Categories

#### Core Framework Skills

Use these skills when working with the main application frameworks:

| Skill | When to Use |
|-------|-------------|
| **[adonisjs](.opencode/skills/adonisjs/)** | Backend development with AdonisJS 6.x, including routing, controllers, models, middleware, authentication, database operations with Lucid ORM, validation, testing, and Ace CLI commands |
| **[shadcn-ui](.opencode/skills/shadcn-ui/)** | shadcn/ui component library for React including installation, component patterns, form recipes, and theming with Tailwind CSS v4 |
| **[tanstack-router](.opencode/skills/tanstack-router/)** | TanStack Router type-safe file-based routing for React including route loaders, type safety, and Cloudflare Workers deployment |
| **[tanstack-query](.opencode/skills/tanstack-query/)** | TanStack Query v5 for data fetching, caching, mutations, and query patterns |
| **[axios](.opencode/skills/axios/)** | HTTP client for browser and Node.js including interceptors, error handling, and request/response configuration |

#### Frontend Styling Skills

Use these skills when implementing visual components:

| Skill | When to Use |
|-------|-------------|
| **[tailwind-patterns](.opencode/skills/tailwind-patterns/)** | Creating responsive layouts, cards, navigation, forms, buttons, and typography using production-ready Tailwind CSS v4 patterns |
| **[frontend-design](.opencode/skills/frontend-design/)** | Building distinctive, production-grade frontend interfaces with high design quality and unique aesthetics |

#### React Ecosystem Skills

Use these skills when working with React:

| Skill | When to Use |
|-------|-------------|
| **[react-components](.opencode/skills/react-components/)** | Convert designs into modular React components using system-level networking and AST-based validation |
| **[tanstack-query](.opencode/skills/tanstack-query/)** | TanStack Query v5 for data fetching, caching, mutations, and query patterns |
| **[vercel-react-best-practices](.opencode/skills/vercel-react-best-practices/)** | React and Next.js performance optimization guidelines from Vercel Engineering |

#### Animation & State Skills

Use these skills for interactive and stateful features:

| Skill | When to Use |
|-------|-------------|
| **[motion](.opencode/skills/motion/)** | Adding animations with Motion Vue including motion components, gesture animations, scroll-linked effects, and layout transitions |
| **[pinia](.opencode/skills/pinia/)** | Managing application state including stores, plugins, SSR considerations, and persistence patterns |

#### Type System Skills

Use this skill for complex type logic:

| Skill | When to Use |
|-------|-------------|
| **[typescript-advanced-types](.opencode/skills/typescript-advanced-types/)** | Implementing complex type logic including generics, conditional types, mapped types, template literals, and utility types |

#### Design & Review Skills

Use these skills for design decisions and quality reviews:

| Skill | When to Use |
|-------|-------------|
| **[ui-ux-pro-max](.opencode/skills/ui-ux-pro-max/)** | Systematic design decisions including design systems, component patterns, color palettes, typography pairings, and comprehensive style guidance |
| **[web-design-guidelines](.opencode/skills/web-design-guidelines/)** | Reviewing UI code for accessibility compliance, design audits, and UX best practices |

#### Product Management Skills

Use this skill for feature planning and prioritization:

| Skill | When to Use |
|-------|-------------|
| **[product-manager-toolkit](.opencode/skills/product-manager-toolkit/)** | Feature prioritization using RICE, customer interview analysis, PRD templates, discovery frameworks, and go-to-market strategies |

### Quick Lookup Table

| Task | Skill |
|------|-------|
| Create backend controller | adonisjs |
| Create migration | adonisjs |
| Set up authentication | adonisjs |
| Write validator | adonisjs |
| Create page routing | tanstack-router |
| Set up route with data loading | tanstack-router + tanstack-query |
| Build component with shadcn/ui | shadcn-ui |
| Build form with validation | shadcn-ui + react-hook-form + zod |
| Configure API client | axios |
| Style with Tailwind | tailwind-patterns |
| Create custom component | react-components |
| Data fetching | tanstack-query |
| Complex typing | typescript-advanced-types |
| Design decisions | ui-ux-pro-max |
| Accessibility review | web-design-guidelines |
| Feature planning | product-manager-toolkit |

### How to Use Skills

1. **Identify the Domain**: Determine which technical domain applies to your task
2. **Load the Skill**: Reference the relevant skill directory
3. **Read Relevant Sections**: Skills are organized by topic; load only what you need
4. **Follow Patterns**: Implement according to the patterns and examples provided
5. **Consult References**: Check the references subdirectory for detailed guidance

### Skill Structure

Most skills follow this structure:

```
.opencode/skills/<name>/
├── SKILL.md              # Main skill documentation
├── references/           # Detailed reference guides
│   ├── topic1.md
│   └── topic2.md
├── components/           # Component-specific docs (if applicable)
│   └── component-name.md
└── scripts/              # Utility scripts (if applicable)
```

### Combining Skills

Many tasks require multiple skills. For example:

- **Building a form page**: shadcn-ui + react-hook-form + zod
- **Creating an API endpoint**: adonisjs + typescript-advanced-types
- **Implementing a dashboard**: tanstack-router + tanstack-query + axios + shadcn-ui + ui-ux-pro-max

When combining skills, follow the primary framework's conventions first, then apply supplementary skills as needed.

### Boundary Rules Reference

Skills complement the boundary rules defined in this document:
- **Must Do**: Skills help you follow framework best practices
- **Ask First**: Skills identify when to seek approval for significant changes
- **Never Do**: Skills reinforce prohibited practices and anti-patterns
