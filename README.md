# Elynd

[English](./README.en.md) | 中文

---

## 产品简介

**Elynd** 是面向「想学英语却难以长期坚持」的成年人的英语**学习空间**：以有趣、大部分能懂的真实内容（阅读 + 听力）为主，用工具（含 AI）**降低理解阻力**——不是课程平台、背词 App，也不是聊天机器人。

目标用户：英语基础一般、因工作/生活需要提升英语、却反复在课程与 App 上放弃的成年人。

产品理念与决策文档（英文 SSOT）：[`docs/product/`](./docs/product/)。

### 产品方向（主循环）

| 空间          | 说明                                     |
| ------------- | ---------------------------------------- |
| Library       | 发现难度合适、愿意读完的内容             |
| Learning Room | 阅读 / 听力 + 按需理解辅助               |
| Practice      | 读懂之后的轻量确认与表达                 |
| Review        | 在语境中再次遇见重要表达                 |
| Progress      | 看见与英语相处的时间与习惯（非考试排行） |

> 当前 `refactor/v2` 分支为 Nest + Next 脚手架；业务功能仍在迁移中。工程上首个可用闭环是 **注册 / 登录（cookie session）/ Dashboard**。学习闭环目标见 [`docs/product/mvp-scope.md`](./docs/product/mvp-scope.md)。

## 技术栈

| 层     | 技术                                                                                        |
| ------ | ------------------------------------------------------------------------------------------- |
| API    | NestJS、Better Auth（cookie session）、Drizzle、PostgreSQL、Redis（ioredis，端口 **6380**） |
| Web    | Next.js App Router、React、TanStack Query/Form、Tailwind CSS v4（端口 **3000**）            |
| 包管理 | pnpm workspace（`apps/*`、`packages/*`）                                                    |

## 环境要求

| 工具    | 版本                      |
| ------- | ------------------------- |
| Node.js | ≥ 24.0.0                  |
| pnpm    | ≥ 10.0.0                  |
| Docker  | 用于本地 Postgres + Redis |

## 本地开发

```bash
git clone <repository-url>
cd elynd
pnpm install
```

### 1. 启动数据库与 Redis

```bash
pnpm compose:init
docker compose up -d
```

默认连接（与 compose 示例一致）：

- Postgres: `postgresql://root:root@127.0.0.1:5433/app`
- Redis: `127.0.0.1:6380`（`REDIS_HOST` / `REDIS_PORT`；API 经 `RedisService` / ioredis 接入）

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
