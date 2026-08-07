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

> 当前工程首个可用闭环是 **注册 / 登录（Adonis session cookie）/ Dashboard**。学习闭环目标见 [`docs/product/mvp-scope.md`](./docs/product/mvp-scope.md)。

## 技术栈

| 层     | 技术                                                                                   |
| ------ | -------------------------------------------------------------------------------------- |
| API    | AdonisJS 7、Lucid、PostgreSQL、Redis（端口 **6380**）、session cookie（端口 **3333**） |
| Web    | Next.js App Router、React、TanStack Query/Form、Tailwind CSS v4（端口 **3000**）       |
| 包管理 | pnpm workspace（`apps/*`、`packages/*`）；共享包 `@elynd/shared`                       |

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

- Postgres: `127.0.0.1:5433`（Adonis 默认库名见 `apps/backend/.env.example` 的 `DB_DATABASE`）
- Redis: `127.0.0.1:6380`（`REDIS_HOST` / `REDIS_PORT`）

### 2. 配置环境变量

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
```

按需编辑 `apps/backend/.env`（`APP_KEY`、`DB_*`、`REDIS_*`、`RESEND_API_KEY` 等）。生成 `APP_KEY`：

```bash
cd apps/backend && node ace generate:key
```

### 3. 运行数据库迁移

```bash
cd apps/backend && node ace migration:run
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

## 生产部署

Adonis / Next 的生产部署流水线尚未纳入本仓库。

## License

见 [LICENSE](./LICENSE)。
