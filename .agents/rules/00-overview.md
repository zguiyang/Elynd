# Project Overview

Elynd is a Personal Knowledge Management System built with modern web technologies.

## Project Introduction

Elynd is a Personal Knowledge Management System that provides efficient bookmark management with categories and tags, memos for recording ideas and inspiration, and a secure access token-based authentication system.

## Architecture

The project follows a monorepo architecture using pnpm workspace:

```
Elynd (monorepo)
├── backend/              # AdonisJS 7.x API server
├── web/                  # Vue 3 frontend application
└── web-old/              # Legacy React frontend (deprecated)
```

- **Backend**: REST API server on port 3333
- **Frontend**: Client-side application on port 3000
- **Communication**: REST API with Bearer Token authentication

## Tech Stack

### Backend
- **Framework**: AdonisJS 7.x
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Lucid ORM
- **Authentication**: Access Token (not session-based)
- **Testing**: Japa

### Frontend
- **Framework**: Vue 3
- **Build Tool**: Vite 7
- **Language**: TypeScript
- **Routing**: Vue Router 4 (file-based)
- **State Management**: Pinia
- **HTTP Client**: Axios
- **UI Library**: shadcn-vue + Reka UI
- **Styling**: Tailwind CSS v4

### Build & Tools
- **Package Manager**: pnpm workspace
- **Code Quality**: ESLint + Prettier
- **Type Checking**: TypeScript compiler

## Directory Structure

```
Elynd/
├── backend/                    # AdonisJS backend application
│   ├── app/
│   │   ├── controllers/      # HTTP route handlers
│   │   ├── models/           # Database models (Lucid ORM)
│   │   ├── middleware/       # HTTP middleware
│   │   ├── validators/       # Request validators (VineJS)
│   │   ├── services/         # Business logic services
│   │   ├── mails/            # Email templates
│   │   └── exceptions/       # Custom exceptions
│   ├── config/               # Configuration files
│   │   ├── auth.ts           # Authentication configuration
│   │   ├── database.ts       # Database connection
│   │   └── mail.ts           # Email configuration
│   ├── database/
│   │   └── migrations/       # Database schema migrations
│   ├── start/
│   │   ├── routes.ts         # API route definitions
│   │   ├── kernel.ts         # Middleware registration
│   │   └── env.ts            # Environment validation
│   ├── tests/                # Test files (Japa)
│   ├── bin/                  # Entry points
│   ├── ace.js                # CLI tool configuration
│   ├── adonisrc.ts           # AdonisJS configuration
│   └── package.json
│
├── web/                       # Vue 3 frontend application
│   ├── src/
│   │   ├── components/      # Vue components
│   │   │   └── ui/          # shadcn-vue components
│   │   ├── views/           # Page components
│   │   ├── layouts/         # Layout components
│   │   ├── router/          # Vue Router configuration
│   │   ├── stores/          # Pinia stores
│   │   ├── lib/             # Utilities (utils.ts, axios API client)
│   │   ├── styles.css       # Global styles (Tailwind v4)
│   │   ├── main.ts          # Entry point
│   │   └── App.vue          # Root component
│   ├── public/               # Static files
│   ├── vite.config.ts        # Vite configuration
│   ├── tsconfig.json        # TypeScript configuration
│   └── package.json
│
├── package.json               # Root package (workspace manager)
├── pnpm-workspace.yaml       # Workspace configuration
├── AGENTS.md                # AI assistant guidelines
├── openspec/                # OpenSpec documentation
└── .opencode/               # AI coding rules
    ├── rules/               # Development rules
    └── skills/              # Framework-specific skills
```

## Quick Start

### Install Dependencies

```bash
pnpm install
```

### Environment Variables

Configure backend environment:

```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
```

Configure frontend environment:

```bash
cd web
cp .env.example .env
# Edit .env with your configuration
```

### Development

Start backend server:

```bash
pnpm run dev:backend    # Runs on http://localhost:3333
```

Start frontend server (in another terminal):

```bash
pnpm run dev:web       # Runs on http://localhost:3000
```

### Build for Production

```bash
pnpm run build          # Build both backend and web
pnpm run start          # Start production backend
pnpm run preview        # Preview production web build
```

## Authentication

The project uses Access Token authentication (configured in `backend/config/auth.ts`):

- **Guard**: `api`
- **Provider**: `tokensUserProvider`
- **Storage**: Bearer token in HTTP Authorization header
- **Frontend Storage**: Token stored in `auth_token` cookie
- **User Model**: Has `accessTokens` relationship

### How it Works

1. User logs in via `/api/auth/login`
2. Backend returns JWT access token
3. Frontend stores token in cookie
4. Token automatically attached to all requests via `Authorization: Bearer {token}` header
5. Backend validates token on protected routes using `middleware.auth()`

## OpenSpec Workflow

OpenSpec is a structured change management process that ensures every feature change is fully discussed, designed, and reviewed.

### When to Use OpenSpec

Always use OpenSpec when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

### Workflow Steps

1. **Submit Change Request** - User describes the feature to be added or modified
2. **Create Change Proposal** - AI creates a change proposal file in `openspec/changes/` directory
3. **Review and Discussion** - Review feasibility and completeness, discuss technical details
4. **Implementation** - Implement code according to the proposal
5. **Verification and Commit** - Run quality checks, execute tests, commit code

### Change Proposal Structure

```
openspec/changes/<date>-<feature-name>.md
```

Proposals should include:
- Feature overview
- Background and motivation
- Detailed design
- Implementation steps
- Risks and considerations

### Core Principles

#### ✅ Must Do

- Prefer using `node ace make:*` commands to create files
- Create migration files before modifying database structure
- Run quality checks before committing
- Follow framework-specific development best practices

#### ⚠️ Ask First

- Modifying authentication method or adding new authentication providers
- Adding new dependencies or updating framework versions
- Major database structure changes

#### 🚫 Never Do

- Commit secrets to the code repository
- Modify `node_modules/` directories
- Delete data or directly operate on production database
- Disable framework middleware or security mechanisms

### Documentation Language Convention

- **Conversation**: Chinese (中文) for all AI interactions
- **Documentation**: English for all technical documentation, code comments, and specifications
- **Code**: English for variable names, function names, class names

For detailed OpenSpec documentation, refer to `openspec/AGENTS.md`.
