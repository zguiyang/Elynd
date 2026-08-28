# 书灯阅读（Gloaming Reader）

[English](./README.en.md) | 中文

---

## 产品简介

**书灯阅读**（英文名 **Gloaming** / 全称 Gloaming Reader）是 **AI Native Language Reading Environment**（AI 原生语言阅读环境）：像用现代电子书阅读器一样读真实英文，卡住时获得上下文相关的 AI 帮助。英文名给「暮光时刻」的安静氛围，中文名给「书灯」这盏照亮书页的光——不直译，互相成就。核心不是教语言，而是帮助用户**持续阅读他们真正想读的英文**。

目标用户：不限年龄——学生、成人学习者、英语爱好者、高级读者。缺的不是资料，而是一个能读下去、卡住能获得帮助的环境。

产品理念与决策文档（英文 SSOT）：[`docs/product/`](./docs/product/)。领域模型：[`docs/adr/001-reading-content-domain-model.md`](./docs/adr/001-reading-content-domain-model.md)。

### 产品方向（主循环）

```text
选择真实英文内容 → 打开阅读 → 遇到语言障碍 → 获得上下文帮助 → 继续阅读
```

| 表面   | 说明                                              |
| ------ | ------------------------------------------------- |
| Shelf  | 官方书目（admin EPUB catalog）+ Phase 1b 用户导入 |
| Reader | 安静阅读；划词解释、翻译、TTS                     |
| AI     | 页内同伴，不需要时消失                            |

书灯阅读不是 Duolingo、LingQ、Anki、ChatGPT 阅读插件，也不是 AI 内容工厂。V1 规格：[`docs/product/mvp-scope.md`](./docs/product/mvp-scope.md)。代码去留：[`docs/product/feature-audit.md`](./docs/product/feature-audit.md)。

## 技术栈

| 层     | 技术                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------- |
| API    | Hono、Better Auth、Drizzle、PostgreSQL、Redis（端口 **6380**）、session cookie（端口 **3333**） |
| Web    | Next.js App Router、React、TanStack Query/Form、Tailwind CSS v4（端口 **3000**）                |
| 包管理 | pnpm workspace（`apps/*`、`packages/*`）；`@gloaming/shared`、`@gloaming/db`                    |

## 环境要求

| 工具    | 版本                      |
| ------- | ------------------------- |
| Node.js | ≥ 24.0.0                  |
| pnpm    | ≥ 10.0.0                  |
| Docker  | 用于本地 Postgres + Redis |

## 本地开发

```bash
git clone <repository-url>
cd gloaming
pnpm install
```

### 1. 启动数据库与 Redis

```bash
pnpm compose:init
docker compose up -d
```

默认连接（与 compose / `.env.example` 一致）：

- Postgres: `127.0.0.1:5433`，库名 `gloaming_backend`（`DATABASE_URL`）
- Redis: `127.0.0.1:6380`（`REDIS_URL`）

### 2. 配置环境变量

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
```

按需编辑 `apps/backend/.env`（见 `.env.example`：仅保留运行时会读取的变量）。`BETTER_AUTH_SECRET` 至少 16 字符，例如：

```bash
openssl rand -base64 32
```

### 3. 运行数据库迁移

```bash
pnpm db:migrate
# 或开发期：pnpm db:push
```

### 4. 启动服务

```bash
# 终端 1：API http://localhost:3333
pnpm run dev:backend

# 终端 2：Web http://localhost:3000
pnpm run dev:web
```

浏览器打开 **http://localhost:3000**。

## 常用命令

```bash
pnpm compose:init
pnpm run lint
pnpm run format:check
pnpm run typecheck
pnpm run test
pnpm run build
```

### Backend integration tests (PostgreSQL)

Functional tests use a **separate** database (`gloaming_test`), not `gloaming_backend`:

```bash
cp apps/backend/.env.test.example apps/backend/.env.test
# New compose volumes get gloaming_test automatically; existing volumes:
psql -h 127.0.0.1 -p 5433 -U root -d gloaming_backend -c "CREATE DATABASE gloaming_test;"
pnpm db:migrate:test
pnpm run test:backend
```

## 生产部署

流水线尚未纳入本仓库。已锁定的部署目标（Workers + Node/VPS，产品做完后再做）：[`docs/deploy-targets.md`](./docs/deploy-targets.md)。

## License

见 [LICENSE](./LICENSE)。
