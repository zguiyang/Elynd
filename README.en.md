# Elynd

[中文版](./README.md) | English

---

## Product Overview

**Elynd** is an AI-powered English reading and learning tool that helps users practice English through a seamless "Reading + Listening + Dictionary + AI Q&A" approach.

Our target users are: **Adults with basic English skills who need to learn English for career advancement or work purposes**.

## Core Features

| Feature | Description |
|---------|-------------|
| 📖 **Graded Reading** | Curated articles with difficulty levels (L1/L2/L3), covering business, daily life, tech and more |
| 🎧 **Listen & Read** | TTS audio playback, listen while reading for multi-sensory learning |
| 🔍 **Instant Dictionary** | Click any word to see definitions instantly without interrupting your reading |
| 🤖 **AI Q&A** | AI-powered Q&A based on the current article for deeper comprehension |

## Quick Start

### Requirements

| Tool | Version |
|-----|---------|
| Node.js | ≥ 24.0.0 |
| pnpm | ≥ 10.0.0 |
| PostgreSQL | ≥ 15 |
| Redis | Latest |

### Local Development

**Step 1: Clone the project**

```bash
git clone <repository-url>
cd elynd
```

**Step 2: Install dependencies**

```bash
pnpm install
```

**Step 3: Configure environment variables**

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database configuration

# Frontend
cp web/.env.example web/.env
```

**Step 4: Start database (optional: use Docker)**

```bash
# Start PostgreSQL and Redis using Docker
docker-compose -f docker-compose.dev.yml up -d
```

**Step 5: Initialize database**

```bash
cd backend
node ace migration:run
```

**Step 6: Start development servers**

```bash
# Terminal 1: Start backend (http://localhost:3335)
pnpm run dev:backend

# Terminal 2: Start frontend (http://localhost:3000)
pnpm run dev:web
```

Once started, open **http://localhost:3000** in your browser.

## Docker Deployment

### Production Deployment

> **Deployment Notes**
>
> This project depends on AI model services and TTS (text-to-speech) services:
> - **AI Models**: Uses OpenAI-compatible API format, with more providers coming soon
> - **TTS Services**: Currently only Azure TTS is supported, with more options planned
>
> After deployment, **the first registered user will become the administrator**. Please configure AI services in the admin panel after logging in.

**Step 1: Configure environment variables**

```bash
# Backend production config
cp backend/.env.example backend/.env
# Edit backend/.env with production settings:
# - NODE_ENV=production
# - DB_HOST=your_database_host
# - REDIS_HOST=your_redis_host
# - APP_KEY=（generate with node ace generate:key）
```

**Step 2: Build and start containers**

```bash
# Build and start with Docker Compose
docker-compose -f docker-compose.prod.yml up -d --build
```

**Step 3: Initialize database (first deployment only)**

```bash
# Run migrations inside container
docker exec -it elynd-server sh
node ace migration:run
exit
```

### Deployment Parameters

| Environment Variable | Description | Example |
|----------------------|-------------|---------|
| `PORT` | Backend server port | `3335` |
| `DB_HOST` | PostgreSQL host | `postgres` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | Database user | `root` |
| `DB_PASSWORD` | Database password | `your_password` |
| `DB_DATABASE` | Database name | `app` |
| `REDIS_HOST` | Redis host | `redis` |
| `APP_KEY` | Application key | (required) |

#### Nginx Configuration (Domain Access)

If you need to access the application via domain, use the following Nginx configuration:

```nginx
# /__transmit/ proxy (for SSE real-time communication)
location ^~ /__transmit/ {
    proxy_pass http://127.0.0.1:3335;
    proxy_set_header Host $host;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # SSE critical settings
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}

# /static/ proxy (static assets)
location ^~ /static/ {
    proxy_pass http://127.0.0.1:3335;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Static assets long-term cache
    expires 7d;
    add_header Cache-Control "public, immutable";
}

# /api/ proxy (backend API)
location ^~ /api/ {
    proxy_pass http://127.0.0.1:3335;
    proxy_set_header Host $host;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## FAQ

**Q: Startup failed, database connection error?**

A: Please ensure PostgreSQL is running and check your `.env` database configuration.

**Q: TTS audio not playing?**

A: You need to configure Azure Speech API keys (`TTS_API_KEY` and `TTS_REGION`). If not configured, a fallback solution will be used.

**Q: How to check service status?**

A: Backend health check: `http://localhost:3335/health`

---

<p align="center">
  <strong>Elynd</strong><br>
  AI-Powered English Learning
</p>
