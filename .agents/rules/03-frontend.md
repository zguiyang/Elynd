# Frontend Development Guide

Frontend development guidelines for Elynd project using Vue 3 + Vite + shadcn-vue.

## Naming Conventions

### Vue Component Files

| Directory | File Naming | Usage in Template |
|-----------|-------------|-------------------|
| `components/` | PascalCase (e.g., `UserCard.vue`) | `<UserCard />` |
| `views/` | kebab-case (e.g., `user-profile.vue`) | `<UserProfile />` |
| `layouts/` | kebab-case (e.g., `auth-layout.vue`) | `<AuthLayout />` |

### ESLint Rules

The project uses the following ESLint rules for Vue component naming:

```typescript
// eslint.config.ts
{
  rules: {
    // Allow single-word component names (e.g., Button.vue)
    'vue/multi-word-component-names': 'off',
    // Force PascalCase in templates (e.g., <UserCard /> not <user-card />)
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],
  },
}
```

**Rules Explanation**:
- `vue/multi-word-component-names: off` - Allows single-word names like `Button.vue`
- `vue/component-name-in-template-casing: PascalCase` - Template must use PascalCase (e.g., `<UserCard />`)

### Component Name

| Type | Component Name |
|------|----------------|
| Views/Layouts | `PascalCase` (e.g., `SignIn`, `AuthLayout`) |
| Shared components | `PascalCase` (e.g., `BookmarkCard`) |
| shadcn-vue components | `PascalCase` (e.g., `Button`) |

## Development Guidelines

### Priority 0: Tailwind CSS v4 and Patterns (CRITICAL)

**MUST - All frontend styling must use Tailwind CSS v4 syntax exclusively. No v3 or outdated syntax is allowed.**

**Requirements**:
- Follow **Tailwind CSS v4** specifications strictly
- Use **Tailwind utility classes** for all styling (avoid custom CSS)
- Do not reinvent CSS wheels - leverage existing Tailwind patterns
- All UI components must be built using Tailwind utility classes

**CRITICAL - v4 Syntax Rules**:

#### 1. CSS Import (MANDATORY)

```css
/* ✅ Correct - v4 syntax */
@import "tailwindcss";

/* ❌ Forbidden - v3 syntax */
/* @tailwind base; */
/* @tailwind components; */
/* @tailwind utilities; */
```

#### 2. Theme Configuration

```css
/* ✅ Correct - v4 CSS-first configuration */
@theme {
  --color-brand-500: #3b82f6;
  --font-sans: "Inter", system-ui, sans-serif;
  --breakpoint-3xl: 1920px;
}

/* ❌ Forbidden - v3 JavaScript config */
/* tailwind.config.js */
```

#### 3. Flex Utility Shorthand

```vue
<!-- ✅ Correct - v4 shorthand -->
<div class="shrink-0 grow">

<!-- ❌ Wrong - v3 long form -->
<div class="flex-shrink-0 flex-grow">
```

#### 4. Gradient Syntax

```vue
<!-- ✅ Correct - v4 syntax -->
<div class="bg-linear-to-r from-primary-500 to-primary-600">

<!-- ❌ Wrong - v3 syntax -->
<div class="bg-gradient-to-r from-primary-500 to-primary-600">
```

#### 5. CSS Variable Syntax

```vue
<!-- ✅ Correct - v4 syntax -->
<div class="bg-(--bg-surface) border-(--border-subtle)">

<!-- ❌ Wrong - v3 syntax -->
<div class="bg-[var(--bg-surface)]">
```

#### 6. No Configuration File Required

**Configuration**:
- **v4**: No `tailwind.config.js` required - use `@theme` directive in CSS
- **v4**: Auto-content detection - no `content` array needed
- **v4**: Built-in PostCSS - no external PostCSS config needed

**Forbidden Practices**:

```vue
<!-- ❌ FORBIDDEN - v3 syntax -->
@tailwind base;
@tailwind components;
@tailwind utilities;
flex-shrink-0
flex-grow
bg-gradient-to-r
bg-[var(--color)]
tailwind.config.js (no longer used in v4)
postcss.config.js with autoprefixer (no longer needed)

<!-- ❌ FORBIDDEN - Hardcoded values -->
<div class="bg-[#3b82f6]">
<div class="text-[rgba(0,0,0,0.5)]">
```

**Required Skills Reference**:

When working with Tailwind CSS styling:
1. **MUST** consult [tailwindcss](.opencode/skills/tailwindcss/) skill for v4 syntax, utilities, and theme configuration
2. **MUST** use [tailwindcss-advanced-layouts](.opencode/skills/tailwindcss-advanced-layouts/) skill for complex layouts (grids, flexbox patterns, container queries)
3. For shadcn-vue components, use shadcn-vue skill

**Key Principles**:
1. Use Tailwind CSS v4 syntax (`@import "tailwindcss"`)
2. Avoid custom CSS in `<style>` blocks
3. Use Tailwind class names for all visual effects
4. Prioritize semantic tokens over raw colors (`bg-card` not `bg-blue-500`)
5. Consult Tailwind CSS skills for any styling questions

### Priority 0.5: Theme Color Management (CRITICAL)

MUST - All theme colors must be managed through **semantic variables** to enable unified control and easy maintenance.

**Requirements**:
- Prohibit hardcoded color values (e.g., `#3b82f6`, `bg-blue-500`, `text-gray-900`)
- Use semantic color variables for all theme-related colors
- Manage theme colors centrally to enable single-point updates

**Three-Level Hierarchy (in priority order)**:

#### Level 1: shadcn-vue Semantic Colors (Highest Priority)
**Use this for all standard UI elements**:

1. **shadcn-vue Components**: Use semantic color props
   ```vue
   <!-- ✅ Correct -->
   <Button variant="default">Save</Button>
   <Badge variant="secondary">Complete</Badge>
   <Alert variant="destructive">Warning</Alert>
   
   <!-- ❌ Wrong - hardcoded colors -->
   <Button class="bg-blue-500">Save</Button>
   ```

2. **Tailwind Classes with Semantic Colors**
   ```vue
   <!-- ✅ Correct -->
   <div class="bg-primary text-primary-foreground">...</div>
   <p class="text-secondary">...</p>
   
   <!-- ❌ Wrong - hardcoded colors -->
   <div class="bg-blue-500 text-white">...</div>
   <p class="text-gray-500">...</p>
   ```

**Available Semantic Colors**:
- `primary` - Main CTAs, active navigation, brand elements
- `secondary` - Secondary buttons, alternative actions
- `success` - Success messages, completed states
- `info` - Info alerts, help text, notifications
- `warning` - Warning messages, pending states
- `error` - Error messages, validation errors
- `muted` - Text, borders, backgrounds, disabled states
- `accent` - Highlighted elements

#### Level 2: CSS Variables (For Custom Styling)
**Use when Tailwind classes are insufficient**:

```vue
<!-- ✅ Correct - Use CSS variables -->
<style scoped>
.custom-card {
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
}
</style>
```

#### Level 3: Custom CSS Variables (Last Resort)
**Use only when Levels 1 & 2 cannot meet requirements**:

**Define in** `web/src/styles.css`:
```css
@theme {
  /* Define custom color palette (50-950 required) */
  --color-brand-50: #f0f9ff;
  --color-brand-100: #e0f2fe;
  /* ... up to --color-brand-950 */
  
  /* Define semantic aliases */
  --color-accent: var(--color-brand-500);
}
```

**Usage**:
```vue
<!-- ✅ Correct - Use custom semantic variables -->
<div class="bg-accent text-accent-foreground">...</div>
<div class="bg-brand-500 hover:bg-brand-600">...</div>
```

**Benefits**:
- ✅ **Unified Management**: All theme colors controlled from one place
- ✅ **Easy Maintenance**: Change theme colors once, update entire application
- ✅ **Dynamic Updates**: UI automatically responds to theme changes
- ✅ **Reduced Maintenance Cost**: No need to modify each page/component individually
- ✅ **Consistent Design**: Semantic colors ensure visual consistency

**Forbidden Practices**:
- ❌ Hardcoded hex values: `#3b82f6`, `rgb(59, 130, 246)`
- ❌ Hardcoded Tailwind colors: `bg-blue-500`, `text-gray-900`, `border-red-500`
- ❌ Inline styles with colors: `style={{ color: '#000' }}`
- ❌ Defining same color in multiple places

### Priority 0.75: Auto-Import Configuration (CRITICAL)

MUST - This project uses **unplugin-auto-import** and **unplugin-vue-components** to automatically import APIs and components.

**Configuration**:
- **unplugin-auto-import**: Auto-imports Vue, Vue Router, Pinia, and VueUse APIs
- **unplugin-vue-components**: Auto-imports all components from `src/components/`

**What's Auto-Imported**:

#### 1. Vue APIs
All Vue 3 Composition APIs are auto-imported:

```typescript
// ✅ Correct - No import needed
import { ref, computed, onMounted, watch } from 'vue'  // ❌ Wrong

// Use directly
const count = ref(0)
const doubled = computed(() => count.value * 2)
```

#### 2. Vue Router APIs

```typescript
// ✅ Correct - No import needed
import { useRouter, useRoute } from 'vue-router'  // ❌ Wrong

// Use directly
const router = useRouter()
const route = useRoute()
```

#### 3. Pinia APIs

```typescript
// ✅ Correct - No import needed
import { defineStore } from 'pinia'  // ❌ Wrong
import { storeToRefs } from 'pinia'  // ❌ Wrong

// Use directly
export const useMyStore = defineStore('my', () => { ... })
const { user, isLoading } = storeToRefs(myStore)
```

#### 4. VueUse APIs

```typescript
// ✅ Correct - VueUse 需要手动导入以提高代码可读性
import { useMouse, useStorage, useDark, useToggle } from '@vueuse/core'

// Use directly
const { x, y } = useMouse()
const count = useStorage('count', 0)
const isDark = useDark()
const toggleDark = useToggle(isDark)
```

#### 5. Composables

All composables from `src/composables/` are auto-imported:

```typescript
// ✅ Correct - No import needed
import { useAuth } from '@/composables/useAuth'  // ❌ Wrong

// Use directly
const { login, logout, isAuthenticated } = useAuth()
```

#### 6. Components

All components from `src/components/` (including shadcn-vue components) are auto-imported:

```vue
<script setup lang="ts">
// ✅ Correct - No import needed
import { Button } from '@/components/ui/button'  // ❌ Wrong
import { Card, CardHeader, CardTitle } from '@/components/ui/card'  // ❌ Wrong
import { BookmarkCard } from '@/components/shared/BookmarkCard.vue'  // ❌ Wrong
</script>

<template>
  <!-- Use directly -->
  <Button>Click me</Button>
  <Card>
    <CardHeader>
      <CardTitle>Title</CardTitle>
    </CardHeader>
  </Card>
  <BookmarkCard :data="bookmark" />
</template>
```

**Forbidden Practices**:

```typescript
// ❌ Forbidden - Do NOT import auto-imported APIs
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { defineStore, storeToRefs } from 'pinia'

// ❌ Forbidden - Do NOT import auto-imported components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

// ❌ Forbidden - Do NOT import auto-imported composables
import { useAuth } from '@/composables/useAuth'
import { useBookmark } from '@/composables/useBookmark'

// ✅ Allowed - VueUse 需要手动导入以提高代码可读性
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
```

**What Still Needs Manual Import**:

```typescript
// ✅ These still need manual imports
import axios from 'axios'
import { api } from '@/lib/api'
import { z } from 'zod'
import { useForm } from 'vee-validate'
import { Home, Settings } from 'lucide-vue-next'
import type { User, Bookmark } from '@/types'
import { cn } from '@/lib/utils'
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
```

**Benefits**:
- ✅ **Cleaner Code**: No boilerplate import statements
- ✅ **Faster Development**: Less typing, no import hunting
- ✅ **Reduced Bundle Size**: Tree-shaking works better
- ✅ **Type Safety**: Full TypeScript support via auto-generated `.d.ts` files

**TypeScript Support**:
- Auto-generated types are in:
  - `src/auto-imports.d.ts` - For auto-imported APIs
  - `src/components.d.ts` - For auto-imported components
- These files are automatically updated and should not be manually edited

### ESLint Auto-Detection

**IMPORTANT**: The project now has ESLint rules to automatically detect and prevent manual imports of auto-imported modules. Lint will fail if you try to manually import:

- Vue APIs: `ref`, `computed`, `watch`, `onMounted`, `onUnmounted`, etc.
- Vue Router: `useRouter`, `useRoute`
- Pinia: `defineStore`, `storeToRefs`

**Note**: VueUse modules require manual import for better code readability.

**Exceptions** (these files need manual imports):
- `src/components/ui/**` - shadcn-vue components (internal usage)
- `src/router/**` - Router configuration files
- `src/composables/**` - Composables (internal usage)
- `src/views/**` - View components (VueUse imports)

If lint fails with `no-restricted-imports` error, simply remove the manual import statement - the APIs are already auto-imported.

### Priority 0.8: Composable Return Value Destructuring

MUST - Use destructuring for composable return values. This follows the VueUse community standard.

**Rationale**:
- **Community Standard**: VueUse (the official Vue composition utility library) uses destructuring in all examples
- **Template Friendly**: Destructured refs can be used directly in templates without `.value`
- **Code Clarity**: Explicitly shows which state values are being used

#### ✅ Correct - Destructuring Composable Returns

```typescript
// ✅ Correct - Use destructuring (VueUse community standard)
const { x, y } = useMouse()
const { isDark } = useDark()
const { data, isLoading, error } = useRequest({
  fetcher: () => api.getList(),
})

// In template: {{ data }} ✓, {{ isLoading }} ✓
```

#### ❌ Forbidden - Destructuring Reactive Objects

**Critical**: Do NOT destructure `ref()`, `reactive()`, or store returns directly, as this loses reactivity:

```typescript
import { ref, reactive } from 'vue'

// ❌ Forbidden - Destructuring ref/reactive loses reactivity
const { count } = ref(0)           // Loses reactivity!
const { name } = reactive({ name: 'John' })  // Loses reactivity!

// ❌ Forbidden - Destructuring Pinia store directly loses reactivity
const { user, isLoading } = useUserStore()  // Loses reactivity!

// ✅ Correct - Use storeToRefs for Pinia stores
const userStore = useUserStore()
const { user, isLoading } = storeToRefs(userStore)  // Keeps reactivity

// ✅ Correct - Access properties directly on reactive objects
const state = reactive({ count: 0 })
const count = state.count  // OK - not destructuring, just reading
```

#### Summary

| Source | Can Destructure? | Method |
|--------|-----------------|--------|
| Composables (e.g., `useRequest`, `useMouse`) | ✅ Yes | Direct destructuring |
| Pinia stores | ✅ Yes | Use `storeToRefs()` |
| `ref()` / `reactive()` | ❌ No | Access via dot notation |
| Plain objects from composables | ✅ Yes | Direct destructuring |

This follows the VueUse community convention and ensures proper reactivity while maintaining clean code.

### Priority 1: Required Skills

MUST - Frontend development requires vue-best-practices, shadcn-vue, vue-router-best-practices, and pinia skills.

Consult skills for:
- Vue 3 Composition API patterns
- Components, forms, UI patterns
- Routing, navigation guards
- State management

### Priority 2: Use shadcn-vue Skill

MUST - Use **shadcn-vue skill** for component patterns and recipes.

Query for:
- Component installation commands
- Known gotchas and workarounds
- Form validation patterns
- Data table recipes

**When skill is insufficient**: Use shadcn-vue MCP server for latest information:
```bash
npx shadcn-vue@latest mcp init --client opencode
```

### Priority 3: Design & Aesthetics Skills

SHOULD - Use design skills for UI/UX guidance and creative implementation:

- **[ui-ux-pro-max](.opencode/skills/ui-ux-pro-max/)** - UI/UX design intelligence with extensive design systems, component patterns, color palettes, typography pairings, and style guidance. Use for comprehensive design planning, component libraries, and systematic UI/UX decision-making.

**When to use**:
- Use `ui-ux-pro-max` for: Design systems, component libraries, dashboards, systematic UI patterns, comprehensive style guides

### Priority 4: Vue Performance Skills

SHOULD - Use **vue-best-practices** skill for Vue 3 optimization:

- Vue 3 Composition API patterns
- Reactivity system optimization
- Component rendering optimization
- Bundle size optimization

### Priority 5: Refer to Official Docs

SHOULD - Refer to official documentation.

- https://vuejs.org
- https://shadcn-vue.com
- https://router.vuejs.org
- https://pinia.vuejs.org
- https://tailwindcss.com/docs

## Tech Stack

- **Framework**: Vue 3
- **Build Tool**: Vite 7
- **Language**: TypeScript
- **Routing**: Vue Router 4 (file-based)
- **State Management**: Pinia
- **HTTP Client**: Axios (request/response interceptors)
- **UI Library**: shadcn-vue + Reka UI
- **Styling**: Tailwind CSS v4
- **Form Validation**: vee-validate + zod
- **Icons**: Lucide Vue

## Directory Structure

```
web/
├── src/
│   ├── components/          # Vue components
│   │   ├── ui/            # shadcn-vue components
│   │   └── shared/        # Custom shared components
│   ├── views/             # Page components
│   ├── layouts/           # Layout components
│   ├── router/            # Vue Router configuration
│   │   └── index.ts       # Router definitions
│   ├── stores/             # Pinia stores
│   │   └── *.ts           # Store modules
│   ├── lib/                # Utilities
│   │   ├── utils.ts       # cn() utility
│   │   └── api.ts        # Axios instance with interceptors
│   ├── styles.css         # Global styles (Tailwind v4)
│   ├── main.ts            # Entry point
│   └── App.vue            # Root component
├── public/                  # Static files
├── vite.config.ts          # Vite configuration
├── tsconfig.json          # TypeScript configuration
└── package.json
```

## Common Commands

### Development

```bash
pnpm run dev:web       # Start development server (port 3000)
```

### Code Quality

```bash
pnpm --filter web lint        # Lint code
pnpm --filter web lint --fix  # Auto-fix linting issues
pnpm --filter web typecheck   # Type check
```

### Build

```bash
pnpm --filter web build       # Build for production
pnpm run preview             # Preview production build
```

## Vue Router Conventions

### File-Based Routing

**Location**: `src/router/`

**Convention**:
- Define routes using Vue Router's declarative syntax
- Use lazy loading for route components

**Example**:
```typescript
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/home-view.vue'),
    },
    {
      path: '/auth/sign-in',
      name: 'sign-in',
      component: () => import('@/views/auth/sign-in-view.vue'),
    },
    {
      path: '/workspace',
      name: 'workspace',
      component: () => import('@/views/workspace-view.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

export default router
```

### Route Navigation

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

// Programmatic navigation
router.push('/workspace')
router.push({ name: 'workspace' })
router.push({ name: 'user', params: { id: '123' } })
router.push({ path: '/auth/sign-in', query: { redirect: '/dashboard' } })

// Navigation guard example
router.beforeEach((to, from, next) => {
  const isAuthenticated = /* check auth */
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'sign-in', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})
</script>

<template>
  <router-link to="/">Home</router-link>
  <router-link :to="{ name: 'workspace' }">Workspace</router-link>
  <router-link :to="{ path: '/auth/sign-in', query: { redirect: '/dashboard' } }">Login</router-link>
</template>
```

### Dynamic Routes

```typescript
// Route with params
{
  path: '/users/:id',
  name: 'user-detail',
  component: () => import('@/views/user-detail-view.vue'),
}
```

```vue
<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const userId = route.params.id // TypeScript: route.params.id as string
</script>
```

## shadcn-vue Components

### Priority
1. **Use shadcn-vue components** - First choice for UI elements
2. **Compose shadcn-vue components** - Combine existing components for complex features
3. **Implement from scratch** - Only when #1 and #2 are not possible

### Common Components

| Category | Components |
|----------|------------|
| Buttons | Button |
| Inputs | Input, Textarea, Select, Combobox |
| Forms | Form, Field, Label |
| Cards | Card |
| Feedback | Toast, Alert, Badge |
| Overlay | Dialog, Sheet, Popover, DropdownMenu |
| Data | Table, Tabs, Separator |
| Navigation | NavigationMenu, Command |

### Installation

**MUST - Use shadcn-vue CLI to install components (forbidden to install npm packages directly)**

```bash
# ✅ Correct - Use shadcn-vue CLI
cd web
pnpm dlx shadcn-vue@latest add button
pnpm dlx shadcn-vue@latest add card input label

# ❌ Forbidden - Do not install npm packages directly
pnpm add button card  # ❌ Wrong
pnpm add vue-sonner   # ❌ Wrong
```

**Note**: Some components (e.g., sonner) require additional dependencies:
- `vue-sonner` - sonner toast function library (used internally by shadcn-vue component)

```bash
# sonner requires both component and dependency
pnpm dlx shadcn-vue@latest add sonner
pnpm add vue-sonner  # toast function library
```

```bash
# Foundation components
npx shadcn-vue@latest add button input label card

# Form components
npx shadcn-vue@latest add form textarea select checkbox switch

# Feedback components
npx shadcn-vue@latest add toast alert badge

# Overlay components
npx shadcn-vue@latest add dialog sheet popover dropdown-menu

# Data display
npx shadcn-vue@latest add table tabs separator avatar
```

### Usage Examples

```vue
<script setup lang="ts">
// No imports needed - all auto-imported
const onSubmit = (values: any) => {
  console.log('Submitted:', values)
}
</script>

<template>
  <Card class="w-full max-w-sm">
    <CardHeader>
      <CardTitle>Login</CardTitle>
    </CardHeader>
    <CardContent>
      <form @submit="onSubmit" class="space-y-4">
        <div>
          <Label for="email">Email</Label>
          <Input id="email" type="email" placeholder="Enter your email" />
        </div>
        <Button type="submit">Submit</Button>
      </form>
    </CardContent>
  </Card>
</template>
```

## Pinia State Management

### Store Definition

```typescript
// stores/user-store.ts
// No imports needed - defineStore, ref, computed are auto-imported
import type { User } from '@/types'

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null)
  const isLoading = ref(false)

  // Getters
  const isAuthenticated = computed(() => !!user.value)
  const userName = computed(() => user.value?.name ?? 'Guest')

  // Actions
  async function fetchUser() {
    isLoading.value = true
    try {
      const response = await fetch('/api/auth/me')
      user.value = await response.json()
    } finally {
      isLoading.value = false
    }
  }

  async function login(credentials: { email: string; password: string }) {
    // Login logic
  }

  function logout() {
    user.value = null
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    userName,
    fetchUser,
    login,
    logout,
  }
})
```

### Store Usage in Components

```vue
<script setup lang="ts">
// storeToRefs is auto-imported
import { useUserStore } from '@/stores/user-store'

const userStore = useUserStore()
const { user, isAuthenticated } = storeToRefs(userStore)

// Or use directly (actions)
const { login, logout } = userStore
</script>

<template>
  <div v-if="isAuthenticated">
    Welcome, {{ user?.name }}
    <Button @click="logout">Logout</Button>
  </div>
  <div v-else>
    <Button @click="login({ email: 'test@example.com', password: '123' })">
      Login
    </Button>
  </div>
</template>
```

## API Communication

### API Layer Architecture

This project follows a layered approach for API calls:

| Layer | Location | Approach | Example |
|-------|----------|----------|---------|
| **API Definitions** | `src/api/*.ts` | Use `request` function | `authApi`, `userApi` |
| **JS Layer** | `stores/`, `composables/` | Use api methods + `.catch` | Auth store, article composable |
| **Views Layer** | `views/**` | Use `useRequest` hook | Profile, Settings pages |

### Request Module

**Location**: `src/lib/request.ts`

This module provides a type-safe request function that returns `Promise<T>` directly:

```typescript
import axios, { type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'

const axiosInstance = axios.create({ ... })

// Request interceptor: add auth token
axiosInstance.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`
  }
  return config
})

// Response interceptor: handle errors
axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Handle 401, show toast, etc.
    return Promise.reject(error.response?.data || { message, error: true })
  }
)

// Type-safe request function
export const request = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const res = await axiosInstance(config)
  return res.data
}

// Keep axios instance for special scenarios
export default axiosInstance
```

### API Definitions

**Location**: `src/api/`

Use the `request` function from `src/lib/request.ts`. The function directly returns `Promise<T>`:

```typescript
// src/api/auth.ts
import { request } from '@/lib/request'

export const authApi = {
  login: (data: LoginData) =>
    request<AuthResponse>({ method: 'POST', url: '/api/auth/login', data }),

  register: (data: RegisterData) =>
    request<AuthResponse>({ method: 'POST', url: '/api/auth/register', data }),

  logout: () =>
    request<void>({ method: 'POST', url: '/api/auth/logout' }),
}
```

**Key Points**:
- Use `{ method: 'GET', url: '...' }` or `{ method: 'POST', url: '...', data }` format
- The generic type `<T>` directly represents the return data type
- No need for `.then(res => res.data)` in API layer

### JS Layer: Use api + .catch

**Location**: `stores/`, `composables/`

In JS layer (stores and composables), use api methods with `.catch` for error handling:

```typescript
// ✅ Correct - JS layer uses api + .catch
const login = async (data: LoginData) => {
  const response = await authApi.login(data)
    .then((res) => res as unknown as AuthResponse)
    .catch(() => null)
  
  if (response) {
    token.value = response.token
    return response
  }
  return null
}

// ❌ Forbidden - Don't use try-catch in JS layer
const login = async (data: LoginData) => {
  try {
    const response = await authApi.login(data)
    return response
  } catch (e) {
    return null
  }
}
```

### Views Layer: Use useRequest Hook

**Location**: `views/**`

In views/components, use the `useRequest` hook to handle loading and error states:

```typescript
// ✅ Correct - Views layer uses useRequest hook
// For APIs without parameters, can pass method reference directly
const fetchUserRequest = useRequest<User>({
  fetcher: userApi.getUser,
})

// For APIs with parameters, use arrow function
const fetchUserRequest = useRequest<User>({
  fetcher: () => userApi.getUser(id),
})

// For APIs that need data transformation
const fetchConfigRequest = useRequest<SystemConfig>({
  fetcher: async () => {
    const response = await adminApi.getSystemConfig()
    return {
      aiBaseUrl: response.aiBaseUrl || '',
      aiApiKey: response.aiApiKey || '',
    }
  },
})

const loadUser = async () => {
  const result = await fetchUserRequest.execute()
  if (result) {
    user.value = result
  }
}

// Watch error for toast notifications
watch(() => fetchUserRequest.error.value, (err) => {
  if (err) {
    toast.error('Failed to load user')
  }
})
```

**Template Usage**:
```vue
<template>
  <!-- Use isLoading from useRequest -->
  <div v-if="fetchUserRequest.isLoading.value">
    Loading...
  </div>
  
  <!-- Or handle error display -->
  <div v-else-if="fetchUserRequest.error.value">
    Error occurred
  </div>
</template>
```

### useRequest Hook Pattern

**Location**: `src/composables/useRequest.ts`

The `useRequest` hook provides a simplified way to handle requests:

```typescript
export function useRequest<T>(options: {
  fetcher: () => Promise<T>
}) {
  const isLoading = ref(false)
  const error = ref<unknown>(null)
  const data = ref<T | null>(null)

  async function execute(): Promise<T | null> {
    isLoading.value = true
    error.value = null

    try {
      const result = await options.fetcher()
      data.value = result
      return result
    } catch (e) {
      error.value = e
      return null
    } finally {
      isLoading.value = false
    }
  }

  return { execute, data, isLoading, error }
}
```

### Error Handling in Views

When using `useRequest`, watch the error and show toast notifications:

```typescript
// Watch error and show toast
watch(() => request.error.value, (err) => {
  if (err) {
    toast.error('Operation failed')
  }
})
```

### Summary

| Layer | File Location | Approach | When to Use |
|-------|---------------|----------|--------------|
| API Definitions | `src/api/*.ts` | Use `request` function | Define all endpoints |
| JS Layer | `stores/`, `composables/` | Use api + `.catch` | Business logic, state management |
| Views Layer | `views/**` | Use `useRequest` hook | UI components, pages |

### Forbidden Practices

```typescript
// ❌ Forbidden - Don't use axios instance directly in views
import request from '@/lib/request'
const response = await request.get('/api/users')

// ❌ Forbidden - Don't use try-catch in JS layer
try {
  await authApi.login(data)
} catch (e) {
  // handle error
}

// ❌ Forbidden - Don't use api methods directly in views without useRequest
const response = await userApi.getConfig()  // Should use useRequest in views
```

### API Best Practices Summary

#### Request Function Usage

```typescript
// ✅ Correct - Use request function with proper config format
export const userApi = {
  getUser: () => request<User>({ method: 'GET', url: '/api/user' }),
  
  updateUser: (data) => request<User>({ 
    method: 'PUT', 
    url: '/api/user', 
    data 
  }),
  
  // With query params
  getList: (params) => request<User[]>({ 
    method: 'GET', 
    url: '/api/users', 
    params 
  }),
}

// ❌ Wrong - Old axios-style syntax
export const userApi = {
  getUser: () => request.get<User>('/api/user'),  // ❌
}
```

#### useRequest Hook Usage

```typescript
// ✅ Correct - Pass method reference for no-param APIs
const fetchUserRequest = useRequest<User>({
  fetcher: userApi.getUser,
})

// ✅ Correct - Use arrow function for APIs with params
const fetchUserRequest = useRequest<User>({
  fetcher: () => userApi.getUser(id),
})

// ✅ Correct - Use async for data transformation
const fetchConfigRequest = useRequest<SystemConfig>({
  fetcher: async () => {
    const response = await adminApi.getSystemConfig()
    return { /* transformed data */ }
  },
})
```

### Error Handling in Views

When using `useRequest`, watch the error and show toast notifications:

```typescript
// Watch error and show toast
watch(() => request.error.value, (err) => {
  if (err) {
    toast.error('Operation failed')
  }
})
```

## Form Validation

### With vee-validate + zod

```vue
<script setup lang="ts">
// Only manual imports needed
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
// Form, FormField, FormItem, FormLabel, FormMessage, Input, Button are auto-imported

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const form = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {
    email: '',
    password: '',
  },
})

const onSubmit = form.handleSubmit((values) => {
  console.log('Submitted:', values)
})
</script>

<template>
  <Form @submit="onSubmit">
    <FormField name="email" v-slot="{ field }">
      <FormItem>
        <FormLabel>Email</FormLabel>
        <Input v-bind="field" type="email" />
        <FormMessage />
      </FormItem>
    </FormField>
    <Button type="submit">Submit</Button>
  </Form>
</template>
```

## Icons

### Lucide Vue

```vue
<script setup lang="ts">
// Only icons need manual import
import { Home, Users, Settings } from 'lucide-vue-next'
</script>

<template>
  <Button>
    <Home class="mr-2" />
    Home
  </Button>
  
  <!-- Or use as component -->
  <component :is="iconMap.home" />
</template>

<script lang="ts">
const iconMap = {
  home: Home,
  users: Users,
  settings: Settings,
}
</script>
```

## Configuration

### Vite Config

**Location**: `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### TypeScript Config

**Location**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Environment Variables

**Reference**: `web/.env.example`

**Key variables**:
- `VITE_API_BASE_URL` - Backend API URL

**Usage**:
```typescript
const apiUrl = import.meta.env.VITE_API_BASE_URL
```

## External Documentation

### Vue 3

- **Official docs**: https://vuejs.org
- **Use vue-best-practices skill**: Available in `.opencode/skills/vue-best-practices/`

### shadcn-vue

- **Official docs**: https://shadcn-vue.com
- **Use shadcn-vue skill**: Available in `.opencode/skills/shadcn-vue/`

### Vue Router

- **Official docs**: https://router.vuejs.org
- **Use vue-router-best-practices skill**: Available in `.opencode/skills/vue-router-best-practices/`

### Pinia

- **Official docs**: https://pinia.vuejs.org
- **Use pinia skill**: Available in `.opencode/skills/pinia/`

### Axios

- **Official docs**: https://axios-http.com
- **Use axios skill**: Available in `.opencode/skills/axios/`

### Tailwind CSS v4

- **Official docs**: https://tailwindcss.com/docs
- **Use tailwindcss skill**: Available in `.opencode/skills/tailwindcss/` - v4 syntax, utilities, theme configuration
- **Use tailwindcss-advanced-layouts skill**: Available in `.opencode/skills/tailwindcss-advanced-layouts/` - complex layouts, grids, flexbox patterns

### TypeScript

- All components use TypeScript
- Enable strict type checking
- Define props and return types

## TypeScript Best Practices

### Avoid Non-null Assertions

**Why**: Non-null assertions (`!`) can cause runtime crashes if the value is actually null/undefined.

**✅ Correct - Use Proper Authentication Methods**:
```typescript
// ✅ Correct: check authentication first
const user = authStore.user
if (!user) {
  return
}
const userId = user.id
```

**❌ Wrong - Use Non-null Assertion**:
```typescript
// ❌ Wrong: can cause runtime crashes
const userId = authStore.user!.id
```

### Use Type Guards for Error Handling

**Why**: Type assertions bypass TypeScript's type checking, hiding potential errors.

**✅ Correct - Use Type Guards**:
```typescript
// ✅ Correct: use type guards
const handleError = (err: unknown): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    return (err as { message: string }).message
  }
  return 'Unknown error'
}
```

**❌ Wrong - Use `as any`**:
```typescript
// ❌ Wrong: loses type safety
const message = (error as any).message
```

### console Usage

**Note**: Unlike the backend, the frontend application does not have a logger service available. Using `console.log`, `console.error`, etc. is acceptable in the frontend code.

```typescript
// ✅ Allowed - Frontend can use console
console.log('User data:', user)
console.error('Error:', error)

// For user-facing errors, prefer using toast
import { toast } from 'vue-sonner'
toast.error('Operation failed')
```

## ESLint Configuration

This project uses ESLint for code quality.

**Validation Commands**:
```bash
# Lint and auto-fix
pnpm --filter web lint --fix

# Type check
pnpm --filter web typecheck
```
