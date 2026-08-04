# Elynd

[English](./README.en.md) | 中文

---

## 产品简介

**Elynd** 是一款 AI 辅助的英语阅读学习工具，通过「阅读 + 听读 + 查词 + AI 提问」四位一体的方式，帮助用户完成一次低门槛的语言输入练习。

目标用户：**英语基础较弱、因职场/跳槽/工作需要学习英语的成年人**。

### 核心功能（产品方向）

| 功能     | 说明                     |
| -------- | ------------------------ |
| 分级阅读 | 预置难度分级的精选文章   |
| 听读模式 | TTS 语音朗读，边听边读   |
| 即点查词 | 点击单词显示释义         |
| AI 问答  | 基于当前文章内容智能问答 |

> 当前 `refactor/v2` 分支已切到 Nest + Next 脚手架；业务功能仍在从旧栈迁移中。首个可用闭环是 **注册 / 登录（cookie session）/ Dashboard**。

## 技术栈

| 层     | 技术                                                                                          |
| ------ | --------------------------------------------------------------------------------------------- |
| API    | NestJS、Better Auth（cookie session）、Drizzle、PostgreSQL、可选 Redis（预留，端口 **3336**） |
| Web    | Next.js App Router、React、TanStack Query/Form、Tailwind CSS v4（端口 **3000**）              |
| 包管理 | pnpm workspace（`apps/*`、`packages/*`）                                                      |

## 环境要求

| 工具    | 版本                                                    |
| ------- | ------------------------------------------------------- |
| Node.js | ≥ 24.0.0                                                |
| pnpm    | ≥ 10.0.0                                                |
| Docker  | 用于本地 Postgres（可选）；Redis 服务预留，应用暂不依赖 |

## 本地开发

```bash
git clone <repository-url>
cd elynd
pnpm install
```

### 1. 启动数据库（Redis 可选 / 预留）

```bash
pnpm compose:init
docker compose up -d
```

默认连接（与 compose 示例一致）：

- Postgres: `postgresql://root:root@127.0.0.1:5433/app`
- Redis: `127.0.0.1:6380`（compose 中预留；当前 cookie auth 不需要 Redis client / secondaryStorage）

### 2. 配置环境变量

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

按需编辑 `apps/api/.env`（`DATABASE_URI`、`AUTH_SECRET`、`BETTER_AUTH_URL`、`BETTER_AUTH_TRUSTED_ORIGINS` 等）。

### 3. 推送数据库 schema

```bash
pnpm run db:push
```

### 4. 启动服务

```bash
# 终端 1：API http://localhost:3336
pnpm run dev:api

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
pnpm run db:push
```

## 生产部署

Nest / Next 的生产部署流水线尚未纳入本仓库。请勿沿用已删除的 Adonis 部署脚本。

## 旧框架代码

根目录下的 AdonisJS `backend/` 与 Vue `web/` 已从此分支移除。需要对照或迁移旧业务时，请使用分支对比，例如：

```bash
git diff backup/pre-v2 -- backend web
git show backup/pre-v2:backend/app/controllers/books_controller.ts
```

参考分支：`backup/pre-v2`、`main`。

## License

见 [LICENSE](./LICENSE)。
