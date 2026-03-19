# Backend Development Guide

Backend development guidelines for Linky project using AdonisJS 7.x.

Backend changes that affect behavior or correctness must follow [`05-tdd.md`](./05-tdd.md) when in scope.

## Development Guidelines

### Priority 1: Consult AdonisJS Skill

MUST - Always consult [adonisjs](.opencode/skills/adonisjs/) skill before implementing.

Read relevant files:
- basics.md, database.md, testing.md, commands.md

### Priority 2: Use ACE Generators

MUST - Prefer using `node ace make:*` commands to create files.

NEVER - Do not manually create files.

```bash
node ace make:controller AuthController
```

### Priority 3: Follow Official Best Practices

MUST - Follow AdonisJS recommended patterns.

Sources:
- https://docs.adonisjs.com
- .opencode/skills/adonisjs/

## Tech Stack

- **Framework**: AdonisJS 7.x
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Lucid ORM
- **Authentication**: Access Token (not session-based)
- **Validation**: VineJS
- **Testing**: Japa
- **Email**: AdonisJS Mail

## Directory Structure

```
backend/
├── app/                    # Backend application code
│   ├── controllers/        # HTTP route handlers
│   ├── models/            # Database models (Lucid ORM)
│   ├── middleware/        # HTTP middleware
│   ├── validators/        # Request validators (VineJS)
│   ├── services/          # Business logic services
│   ├── mails/             # Email templates
│   └── exceptions/        # Custom exceptions
├── config/                 # Configuration files
│   ├── auth.ts            # Authentication configuration
│   ├── database.ts        # Database connection
│   └── mail.ts            # Email configuration
├── database/
│   └── migrations/        # Database schema migrations
├── start/                  # Startup files
│   ├── routes.ts          # API route definitions
│   ├── kernel.ts          # Middleware registration
│   └── env.ts            # Environment validation
├── tests/                  # Test files (Japa)
├── bin/                    # Entry points (server, console, test)
├── ace.js                  # CLI tool configuration
├── adonisrc.ts             # AdonisJS configuration
└── package.json
```

## Common Commands

### Development

```bash
pnpm run dev:backend    # Start development server (port 3333, with HMR)
```

### Code Quality

```bash
pnpm --filter backend lint        # Lint code
pnpm --filter backend lint --fix  # Auto-fix linting issues
pnpm --filter backend typecheck   # TypeScript type checking
```

### Testing

```bash
pnpm --filter backend test    # Run all tests
```

### Build

```bash
pnpm --filter backend build    # Build for production
pnpm --filter backend start    # Start production server
```

### AdonisJS Generators (Prefer these)

```bash
cd backend
node ace make:controller <name>    # Create controller
node ace make:model <name>         # Create model
node ace make:migration <name>     # Create migration
node ace make:validator <name>     # Create validator
node ace make:middleware <name>    # Create middleware
node ace make:service <name>       # Create service
node ace make:mail <name>          # Create mail
```

**Complete command list**: Run `node ace list` to see all available commands

## AdonisJS Conventions

### Routes

**Location**: `start/routes.ts`

**Structure**:
- All routes are prefixed with `/api`
- Use dynamic import with array syntax for controller references
- Apply middleware for protected routes

**✅ Correct - Dynamic Import with Array Syntax**:
```typescript
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const UserController = () => import('#controllers/user_controller')

router
  .group(() => {
    router.post('/auth/login', [AuthController, 'login'])
    router.get('/users/:id', [UserController, 'show']).middleware(middleware.auth())
  })
  .prefix('api')
```

**❌ Forbidden - Magic String Syntax**:
```typescript
// ❌ Forbidden: magic string syntax
router.post('/auth/login', '#controllers/auth_controller.login')
router.get('/users/:id', '#controllers/user_controller.show')
```

### Controllers

**Location**: `app/controllers/`

**Naming**: PascalCase + `_controller.ts` (e.g., `auth_controller.ts`)

**Conventions**:
- Handle HTTP requests
- Delegate business logic to services
- Return JSON responses
- **Use dependency injection with IoC container (MUST)**

**MUST Use Dependency Injection**:
- Use `@inject()` decorator on the class
- Inject services in constructor
- Access services via `this.serviceName`
- **NEVER** manually instantiate services with `new Service()` inside methods

**MUST Return Data Directly**:
- Return data directly (object, array, string, etc.)
- Framework will automatically serialize to JSON
- **ONLY** use `response` when you need custom status codes or headers

**Example**:
```typescript
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { AuthService } from '#services/auth_service'

@inject()
export default class AuthController {
  constructor(private authService: AuthService) {}  // Inject once

  async login({ request }: HttpContext) {
    const { email, password } = request.all()
    const result = await this.authService.login(email, password)  // Reuse via this
    return result  // Direct return, framework auto-serializes
  }
}
```

**❌ Wrong Examples**:
```typescript
// NEVER manually instantiate services
const authService = new AuthService()  // ❌ Wrong

// NEVER use response.json() unnecessarily
return response.json(result)  // ❌ Wrong (unless needed)
```

### Logging

**✅ MUST Use Logger**

**Forbidden**: Use `console.log` for logging, debugging, or data printing in application code.

**Allowed**:
- **Project scripts**: Standalone scripts (e.g., database migration, data seeding scripts)
- **Special scenarios where logger cannot be injected**: Add comment explaining the reason

**Reasons to Use Logger**:
- Supports log levels (debug/info/warn/error/fatal)
- Auto-includes request ID for request tracing
- Supports multiple log targets (stdout, file, external services)
- Supports sensitive data redaction
- Configurable log output in production

**Usage Patterns**:

**Pattern 1: Import logger service (Recommended for services/standalone modules)**
```typescript
import logger from '@adonisjs/core/services/logger'

logger.info('Operation completed')
logger.warn('Something needs attention')
logger.error({ err: error }, 'Operation failed')
```

**Pattern 2: Use ctx.logger in route handlers (Request-aware logging)**
```typescript
router.get('/users/:id', async ({ logger, params }) => {
  logger.info('Fetching user by id %s', params.id)
})
```

**Pattern 3: Dependency injection in controllers/services**
```typescript
import { inject } from '@adonisjs/core'
import type { Logger } from '@adonisjs/core/types/logger'

@inject()
export default class UserService {
  constructor(private logger: Logger) {}

  async create(data: UserData) {
    this.logger.info('Creating new user')
  }
}
```

**❌ Forbidden**:
```typescript
// ❌ Forbidden: console.log in application code
console.log('User data:', user)
console.error('Error:', error)
```

**✅ Allowed (Exceptions)**:
```typescript
// ✅ Allowed: Project scripts (outside application code)
// scripts/seed-data.ts
console.log('Starting data seeding...')
console.log(`Seeded ${count} records`)
```

**Log Levels**:

| Level | Use Case |
|-------|----------|
| `debug` | Detailed debugging info (dev only) |
| `info` | General operation info |
| `warn` | Potential issues, non-critical failures |
| `error` | Operation failures |
| `fatal` | Critical failures, application crash |

### Structured Logging (MUST)

**Why Structured Logging Matters**:
- Enable log searching/filtering by fields (e.g., userId, articleId)
- Support log aggregation systems (ELK, Loki)
- Enable statistics and alerting
- Improve machine readability

**✅ Correct - Use Object Syntax**:

```typescript
// ✅ Correct: structured logging with object
logger.info({ userId: user.id, action: 'login' }, 'User logged in')
logger.info({ articleId, chapterCount: chapters.length }, 'Generating audio for article')
logger.error({ err: error, userId }, 'Operation failed')
```

**❌ Wrong - Template Strings**:

```typescript
// ❌ Wrong: template strings lose structured logging benefits
logger.info(`User ${user.id} logged in`)
logger.info(`Generating audio for article ${articleId}, ${chapters.length} chapters`)
logger.error(`Operation failed for user ${userId}: ${error.message}`)
```

**⚠️ Warning - printf Style**:

```typescript
// ⚠️ Not recommended: printf style
logger.info('User %d logged in', user.id)
```

**Best Practices**:
1. Always use object syntax: `logger.info({ field: value }, 'message')`
2. Use consistent field names across the codebase
3. Include relevant context fields (userId, articleId, jobId, etc.)
4. Put variable data in the object, not in the message

## Response Format

### Success Responses
- Return business data directly
- Use framework auto-serialization (JSON)
- Do NOT wrap with `{success: true}`

**Examples**:
```typescript
// ✅ Correct
async login() {
  return {user: {...}, token: 'xxx'}
}

async logout() {
  await auth.use('api').invalidateToken()
  // return void
}

// ❌ Wrong
async logout() {
  return {success: true}
}
```

### Error Responses
- Use global exception handler to format errors
- Throw `Exception` with status and message
- Do NOT return `{success: false, message: '...'}`

**Examples**:
```typescript
// ✅ Correct - throw exception
if (!user) {
  throw new Exception('User not found', { status: 404 })
}

// ❌ Wrong - return error in success response
if (!user) {
  return {success: false, message: 'User not found'}
}
```

### Global Error Format

All errors are automatically formatted by global exception handler:

**Development**:
```json
{
  "error": {...},
  "message": "Error description"
}
```

**Production**:
```json
{
  "message": "Error description"
}
```

### VineJS Validation Errors

VineJS validation errors are automatically converted to standard format by error handler.

**Development**:
```json
{
  "error": {
    "messages": {
      "email": ["Email is required"]
    }
  },
  "message": "Email is required"
}
```

**Production**:
```json
{
  "message": "Email is required"
}
```

### Backend Responsibility

- **Intercept all error types**: Including VineJS validation errors, HTTP errors, custom exceptions
- **Convert to standard format**:
  - Development: `{error: {...}, message: "..."}`
  - Production: `{message: "..."}`
- **Simplify frontend**: Frontend only needs to read `error.data.message`

### Models

**Location**: `app/models/`

**Naming**: PascalCase (e.g., `User.ts`, `Bookmark.ts`)

**Conventions**:
- Define data structure and relationships
- Use Lucid ORM syntax
- Include fillable columns
- Define relationships using decorators

**Example**:
```typescript
import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import { type HasMany } from '@adonisjs/lucid/types/relations'
import Bookmark from './bookmark.js'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @hasMany(() => Bookmark)
  declare bookmarks: HasMany<typeof Bookmark>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

### Middleware

**Location**: `app/middleware/`

**Naming**: kebab-case + `_middleware.ts` (e.g., `auth_middleware.ts`)

**Conventions**:
- Cross-cutting concerns (auth, logging, etc.)
- Extend `BaseMiddleware`
- Register in `start/kernel.ts`

### Validators

**Location**: `app/validators/`

**File Creation Rules**:

| Scenario | Action |
|----------|--------|
| New feature module | Use `node ace make:validator <name>` to create file |
| New operation in existing module | Add to existing file |

**Prohibition**: Manually create validator files is NOT allowed.

```bash
# ✅ Correct: use ace command
cd backend
node ace make:validator auth

# ❌ Wrong: manually create auth_validator.ts
```

**Naming Rules**:

| Item | Format | Example |
|------|--------|---------|
| File name | `kebab-case` + `_validator.ts` | `auth_validator.ts` |
| Export name | `camelCase` + `Validator` | `loginValidator` |
| Type name | Same as export | `LoginValidator` |

**File Content Rules**:

Each file must contain:
1. All related validators (all operations for one module)
2. Corresponding type exports

```typescript
// auth_validator.ts
import vine from '@vinejs/vine'

export const loginValidator = vine.compile(...)
export const registerValidator = vine.compile(...)
export const resetPasswordValidator = vine.compile(...)

export type { LoginValidator, RegisterValidator, ResetPasswordValidator }
```

**Constants Usage Rules**:

| Must use constants | Can omit constants |
|-------------------|-------------------|
| Length limits (maxLength) | Simple validations (email, url) |
| Enum values (enum) | Unique validations (unique) |
| Repeated validation patterns | Field existence (optional) |

```typescript
// ✅ Must use constants
import { VALIDATION } from '#constants/validation'

title: vine.string().maxLength(VALIDATION.TITLE_MAX)

// ✅ Can omit constants
email: vine.string().email()
```

**Import Order**:

```typescript
// 1. Third-party libraries
import vine from '@vinejs/vine'

// 2. Project constants
import { VALIDATION } from '#constants/validation'

// 3. Types (if any)
import type { SomeType } from '#types/some_type'
```

**Recommended**:
```typescript
// ✅ Use ace command to create files
// ✅ One module per file
// ✅ Export validators + types
// ✅ Use constants
// ✅ Extract shared schema (3+ repetitions)
```

**Prohibited**:
```typescript
// ❌ Manually create validator files
// ❌ Split files by operation
// ❌ No type exports
// ❌ Use magic numbers directly
```

**Directory Structure Example**:
```
validators/
├── auth_validator.ts        # login, register, resetPassword
├── bookmark_validator.ts    # create, update, pagination
├── tag_validator.ts         # create, update
└── memo_validator.ts        # create, update
```

#### ⚠️ Common Mistakes to Avoid

| Mistake | Wrong | Correct |
|---------|-------|---------|
| Missing `_validator` suffix | `change_password.ts` | `change_password_validator.ts` |
| File name same as module | `user_config.ts` | `user_config_validator.ts` |
| No type exports | Only export validator | Export validator + type |

**❌ Forbidden - Incorrect Validator File Names**:
```typescript
// ❌ Wrong: missing _validator suffix
// validators/change_password.ts
export const changePasswordValidator = ...

// ❌ Wrong: no type export
export const changePasswordValidator = ...
// Missing: export type ChangePasswordValidator = ...

// ✅ Correct: proper naming and exports
// validators/change_password_validator.ts
export const changePasswordValidator = vine.compile(...)
export type ChangePasswordValidator = Infer<typeof changePasswordValidator>
```

### Services

**Location**: `app/services/`

**Naming**: PascalCase (e.g., `AuthService.ts`)

**Conventions**:
- Contain business logic
- Be independent of HTTP context
- Reusable across controllers
- **MUST be a class** with `@inject()` decorator

#### ⚠️ What Should NOT Go in Services Directory

Only classes with business logic (Services) should be placed in this directory. **DO NOT** place utility functions or constants here.

| Wrong | Correct |
|-------|---------|
| `app/services/speech_sdk_time.ts` (just exports functions) | `app/utils/speech_sdk_time.ts` |
| `app/services/constants.ts` (just exports values) | `app/constants/index.ts` |

**Correct Directory Structure**:
```
app/
├── services/          # Business logic classes (must use @inject())
│   ├── auth_service.ts
│   ├── user_service.ts
│   └── ...
├── utils/            # Utility functions and helpers
│   ├── speech_sdk_time.ts
│   └── ...
├── constants/        # Application constants
│   └── index.ts
└── ...
```

### Service Layer Dependency Rules

This section defines how services should interact with each other and with models.

#### Core Principles

**Write Operations (CRUD - Create, Update, Delete)**:
- MUST go through the corresponding Service
- NEVER directly use Model for write operations
- Ensures business logic and data consistency

**Read Operations (Queries)**:
- CAN directly use Model/Repository for simple queries
- Special services (e.g., SearchService) CAN query multiple models
- Follows CQRS (Command Query Responsibility Segregation) principles

#### Service-to-Service Communication

**When Service A needs access to Service B's data**:

| Operation Type | Approach |
|---------------|----------|
| Write operations | Call Service B's public methods |
| Read operations | Either query Model directly or call Service B's query methods |

**✅ Correct - Dependency Injection**:
```typescript
import { inject } from '@adonisjs/core'
import type { BookmarkService } from './bookmark_service.js'
import type { MemoService } from './memo_service.js'

@inject()
export class TagService {
  constructor(
    private bookmarkService: BookmarkService,
    private memoService: MemoService
  ) {}

  async getItemsByTag(userId: number, tagId: number) {
    // Read operation: can query through Service or directly
    // Here we call Service B's query method
    return await this.bookmarkService.findByTagId(userId, tagId)
  }
}
```

**❌ Forbidden - Direct Model Access for Write**:
```typescript
// ❌ Forbidden: Service A directly creates/updates Service B's model
import Bookmark from '#models/bookmark'

async someMethod() {
  await Bookmark.create({ ... })  // ❌ Wrong if Bookmark is Service B's domain
}
```

#### Dependency Injection Pattern

- Use `@inject()` decorator on the class
- Declare dependencies in constructor
- Access services via `this.serviceName`
- NEVER manually instantiate services with `new Service()`

**✅ Correct**:
```typescript
@inject()
export class TagService {
  constructor(
    private bookmarkService: BookmarkService,
    private memoService: MemoService
  ) {}

  async getItems(userId: number, tagId: number) {
    return await this.bookmarkService.findByTagId(userId, tagId)
  }
}
```

**❌ Wrong**:
```typescript
// ❌ Wrong: manual instantiation
const bookmarkService = new BookmarkService()

// ❌ Wrong: no dependency injection
export class TagService {
  async getItems(userId: number, tagId: number) {
    const bookmarkService = new BookmarkService()  // ❌ Wrong
  }
}
```

#### Special Cases

**SearchService Exception**:
SearchService is a global search aggregator that queries multiple models. Direct model access is acceptable here because:
1. This is a read-only operation (no business logic)
2. Aggregating data from multiple sources is its core responsibility
3. Going through individual services would add unnecessary complexity

```typescript
@inject()
export class SearchService {
  /**
   * SearchService is a global search aggregator that queries multiple models.
   *
   * Direct model access is acceptable here because:
   * 1. This is a read-only operation (no business logic)
   * 2. Aggregating data from multiple sources is its core responsibility
   * 3. Going through individual services would add unnecessary complexity
   *
   * This follows CQRS principles where read operations can be handled differently from write operations.
   */
  async search(userId: number, query: string) {
    const [bookmarks, memos, tags] = await Promise.all([
      Bookmark.query().where(...),
      Memo.query().where(...),
      Tag.query().where(...),
    ])
  }
}
```

#### Best Practices

1. **Add Query Methods to Services**: When another service needs to query your service's data, add query methods to your service instead of letting them access the model directly.

2. **Document Exceptions**: When direct model access is acceptable (like SearchService), add comments explaining why.

3. **Follow Single Responsibility**: Each service should own its domain logic. Queries that span multiple domains can be handled by aggregator services.

4. **Testability**: Services should be testable in isolation. Dependency injection enables easier mocking.

#### Decision Matrix

| Scenario | Can Access Model Directly | Must Use Service Method |
|----------|-------------------------|------------------------|
| Simple read query | ✅ Yes | ⚠️ Optional |
| Complex cross-domain aggregation | ✅ Yes (aggregator services) | ⚠️ Optional |
| Create/Update/Delete operations | ❌ No | ✅ Yes |
| Operations requiring business logic | ❌ No | ✅ Yes |
| Operations requiring transaction | ❌ No | ✅ Yes |

#### Summary

| Pattern | Description |
|---------|-------------|
| **Service owns Model** | Each service is responsible for its domain models |
| **Write through Service** | All write operations must go through corresponding service |
| **Read flexibility** | Read operations have more flexibility based on context |
| **Dependency Injection** | Use `@inject()` for service dependencies |
| **No Manual Instantiation** | Never use `new Service()` inside methods |
| **Document Exceptions** | Explain why direct model access is used (e.g., SearchService) |

### Mails

**Location**: `app/mails/`

**Naming**: PascalCase (e.g., `VerificationEmail.ts`)

**Conventions**:
- Use AdonisJS Mail module
- Define email templates
- Use Edge templates in `resources/views/emails/`

## Database

### Migrations

**Location**: `database/migrations/`

**Conventions**:
- Create migration files before modifying database structure
- Use descriptive names with timestamp
- Define schema using Knex schema builder

**Example**:
```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class UsersSchema extends BaseSchema {
  protected tableName = 'users'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('email').notNullable().unique()
      table.string('password').notNullable()
      table.timestamps(true, true)
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
```

**Commands**:
```bash
node ace migration:run    # Run pending migrations
node ace migration:rollback  # Rollback last migration
node ace make:migration <name>  # Create new migration
```

### Models

Refer to "Models" section above for details.

## Testing

**Location**: `tests/`

**Structure**:
- Unit tests: `tests/unit/**/*.spec.ts`
- Functional tests: `tests/functional/**/*.spec.ts`

**Framework**: Japa

**Conventions**:
- Write tests for critical business logic
- Use descriptive test names
- Mock external dependencies when needed

**Commands**:
```bash
pnpm --filter backend test                # Run all tests
node ace test --files="**/*.spec.ts"    # Run specific tests
```

## Configuration

**Location**: `config/`

**Key files**:
- `auth.ts` - Authentication configuration (guard: `api`, provider: `tokensUserProvider`)
- `database.ts` - Database connection (PostgreSQL)
- `mail.ts` - Email service configuration
- `cors.ts` - CORS configuration

## Environment Variables

**Reference**: `backend/.env.example`

**Key variables**:
- `PORT=3333` - Server port
- `APP_KEY=` - Application key (required)
- `PG_HOST=127.0.0.1` - PostgreSQL host
- `PG_PORT=5432` - PostgreSQL port
- `PG_USER=root` - PostgreSQL user
- `PG_PASSWORD=root` - PostgreSQL password
- `PG_DATABASE=app` - Database name

## Path Aliases

AdonisJS supports path aliases defined in `package.json`:

```typescript
import Controller from '#controllers/controller'
import Model from '#models/model'
import Middleware from '#middleware/middleware'
import Validator from '#validators/validator'
import Service from '#services/service'
import Config from '#config/config'
import Migration from '#database/migration'
import Start from '#start/start'
import Test from '#tests/test'
```

## External Documentation

For detailed AdonisJS documentation, refer to:

- **Official docs**: https://docs.adonisjs.com
- **Use adonisjs skill**: Available in `.opencode/skills/adonisjs/`
  - `basics.md` - Routing, middleware, etc.
  - `database.md` - Database operations and migrations
  - `testing.md` - Testing with Japa
  - `commands.md` - Available Ace commands

## Type Safety Best Practices

### Avoid `as any` Type Assertions

**Why**: Type assertions bypass TypeScript's type checking, hiding potential errors.

**✅ Correct - Use Type Guards**:
```typescript
// ✅ Correct: use type guards
const getStatus = (err: unknown): number => {
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as { status: number }).status
  }
  return 500
}
```

**❌ Wrong - Use `as any`**:
```typescript
// ❌ Wrong: loses type safety
const status = (error as any).status
```

### Avoid Non-null Assertions (`!`)

**Why**: Non-null assertions can cause runtime crashes if the value is actually null/undefined.

**✅ Correct - Use getUserOrFail()**:
```typescript
// ✅ Correct: throws clear error if not authenticated
const user = auth.getUserOrFail()
const userId = user.id
```

**❌ Wrong - Use Non-null Assertion**:
```typescript
// ❌ Wrong: can cause runtime crashes
const userId = auth.user!.id
```

### Use Exception with HTTP Status

**Why**: AdonisJS Exception allows setting HTTP status codes for proper error responses.

**✅ Correct - Use Exception with Status**:
```typescript
// ✅ Correct: proper HTTP error with status code
throw new Exception('Article not found', { status: 404 })
```

**❌ Wrong - Use Plain Error**:
```typescript
// ❌ Wrong: generic Error doesn't carry HTTP status
throw new Error(`Article ${articleId} not found`)
```

### Transaction Type Handling

**Note**: AdonisJS Lucid ORM's transaction types have known limitations. When using transactions:

```typescript
// Recommended approach: use unknown with explicit comments
async findOrCreateByName(name: string, trx?: unknown): Promise<Tag> {
  if (trx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await Tag.query(trx as any).where('slug', slug).first()
  }
  return await Tag.firstOrCreate({ slug }, { name, slug })
}
```

Add eslint-disable comments to explain why `as any` is necessary.

### Known Type Limitations

| Scenario | Recommended Approach |
|----------|---------------------|
| Lucid transaction client | Use `unknown` with `as any` + eslint comment |
| OpenAI SDK response types | Use `unknown` casting with explicit interface |
| Error handling in catch blocks | Use type guards instead of `as any` |

## Knowledge Base: Issues Fixed

This section documents issues discovered during code reviews to prevent recurrence.

### Issue 1: Structured Logging

**Problem**: Using template strings in logger calls made logs unsearchable:
```typescript
// ❌ Before: couldn't filter by articleId
logger.info(`Generating audio for article ${articleId}, ${chapters.length} chapters`)
```

**Solution**: Use object syntax for structured logging:
```typescript
// ✅ After: can filter by articleId in log aggregation systems
logger.info({ articleId, chapterCount: chapters.length }, 'Generating audio for article')
```

### Issue 2: Type Assertions

**Problem**: Using `as any` throughout the codebase reduced type safety:
```typescript
// ❌ Before: no type safety
const content = (response as any).choices[0]?.message?.content
```

**Solution**: Use proper types or type guards:
```typescript
// ✅ After: proper typing
const completionResponse = response as unknown as { choices?: Array<{ message?: { content?: string } }> }
const content = completionResponse.choices?.[0]?.message?.content || ''
```

### Issue 3: Non-null Assertions

**Problem**: Using `auth.user!` could cause runtime crashes:
```typescript
// ❌ Before: runtime error if not authenticated
const userId = auth.user!.id
```

**Solution**: Use proper authentication methods:
```typescript
// ✅ After: clear error handling
const user = auth.getUserOrFail()
const userId = user.id
```

### Issue 4: Service Layer Code Simplification

**Problem**: Multiple if statements for updating model fields:
```typescript
// ❌ Before: verbose update method
async update(userId: number, data: UpdateUserConfigData): Promise<UserConfig> {
  const config = await UserConfig.findByOrFail('user_id', userId)
  if (data.nativeLanguage !== undefined) {
    config.nativeLanguage = data.nativeLanguage
  }
  if (data.targetLanguage !== undefined) {
    config.targetLanguage = data.targetLanguage
  }
  if (data.vocabularyLevel !== undefined) {
    config.vocabularyLevel = data.vocabularyLevel
  }
  // ... more if statements
  await config.save()
}
```

**Solution**: Use `merge()` to simplify updates:
```typescript
// ✅ After: concise update using merge
async update(userId: number, data: UpdateUserConfigData): Promise<UserConfig> {
  const config = await UserConfig.findByOrFail('user_id', userId)
  config.merge(data)  // VineJS validator already filters undefined
  await config.save()
  return config
}
```

### Issue 5: Duplicate Query Logic in Services

**Problem**: Similar query logic repeated in multiple methods:
```typescript
// ❌ Before: duplicated query building
async findPublishedById(id: number) {
  const article = await Article.query()
    .where('id', id)
    .where('isPublished', true)
    .preload('tags')
    .preload('chapters', ...)
    .first()
  // ...
}

async findById(id: number) {
  const article = await Article.query()
    .where('id', id)
    .preload('tags')
    .preload('chapters', ...)
    .first()
  // ...
}
```

**Solution**: Extract common query logic into private methods:
```typescript
// ✅ After: extract common query builder
private buildArticleQuery(requirePublished: boolean) {
  const query = Article.query()
    .preload('tags')
    .preload('chapters', ...)

  if (requirePublished) {
    query.where('isPublished', true)
  }
  return query
}

async findPublishedById(id: number) {
  return await this.buildArticleQuery(true).where('id', id).first()
}

async findById(id: number) {
  return await this.buildArticleQuery(false).where('id', id).first()
}
```

### Issue 6: Business Logic in Controllers

**Problem**: Business logic (like building prompts) exists in controllers:
```typescript
// ❌ Before: business logic in controller
async aiChat({ params, request }: HttpContext) {
  const article = await this.articleService.findPublishedById(params.id)
  const aiConfig = await this.configService.getAiConfig()

  // ❌ Business logic in controller
  const systemPrompt = `You are a professional English reading assistant...`
  
  const response = await this.aiService.chat(aiConfig, {...})
}
```

**Solution**: Move business logic to Service layer:
```typescript
// ✅ After: controller delegates to service
async aiChat({ auth, params, request }: HttpContext) {
  const data = await request.validateUsing(articleChatValidator)
  const user = auth.getUserOrFail()

  await this.articleService.findPublishedById(params.id)

  return await this.articleChatService.chat({
    userId: user.id,
    articleId: params.id,
    message: data.message,
  })
}
```

### Issue 7: Redundant Middleware Checks

**Problem**: Middleware performing redundant authentication checks:
```typescript
// ❌ Before: redundant check (auth middleware already validates)
async handle(ctx: HttpContext, next: NextFn) {
  if (!ctx.auth.isAuthenticated) {  // ❌ Redundant
    throw new Exception('Unauthenticated', { status: 401 })
  }
  if (ctx.auth.user?.isAdmin !== true) {
    throw new Exception('Forbidden', { status: 403 })
  }
  return next()
}
```

**Solution**: Remove redundant checks:
```typescript
// ✅ After: only check authorization
async handle(ctx: HttpContext, next: NextFn) {
  if (ctx.auth.user?.isAdmin !== true) {
    throw new Exception('Forbidden: Admin access required', { status: 403 })
  }
  return next()
}
```

### Issue 8: Unused Validator Definitions

**Problem**: Validator files contain unused definitions:
```typescript
// ❌ Before: unused validator taking up space
export const chatValidator = vine.compile(...)
export type ChatValidator = Infer<typeof chatValidator>  // Never used

export const articleChatValidator = vine.compile(...)
```

**Solution**: Remove unused validators:
```typescript
// ✅ After: only keep used validators
export const articleChatValidator = vine.compile(...)
export type ArticleChatValidator = Infer<typeof articleChatValidator>
```

**Rule**: Regularly audit validator files and remove unused definitions.

## Best Practices Summary

### Service Layer

| Practice | Description |
|----------|-------------|
| Use `merge()` for updates | Simplify model update operations |
| Extract common queries | Use private methods for repeated query logic |
| Keep business logic in services | Controllers should only delegate to services |

### Controllers

| Practice | Description |
|----------|-------------|
| No business logic | Delegate all business logic to services |
| Minimal transformation | Return data directly from services |
| Use dependency injection | Inject services via constructor |

### Middleware

| Practice | Description |
|----------|-------------|
| Avoid redundant checks | Trust earlier middleware for basic validation |
| Single responsibility | Each middleware should do one thing well |

### Validators

| Practice | Description |
|----------|-------------|
| Remove unused validators | Keep validator files clean |
| Use constants | Reuse validation rules via constants |
| Export types | Always export corresponding types |
