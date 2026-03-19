# Elynd

[English](./README.en.md) | 中文

---

## 产品简介

**Elynd** 是一款 AI 辅助的英语阅读学习工具，通过「阅读 + 听读 + 查词 + AI 提问」四位一体的方式，帮助用户完成一次低门槛的语言输入练习。

我们的目标用户是：**英语基础较弱、因职场/跳槽/工作需要学习英语的成年人**。

### 核心功能

| 功能 | 说明 |
|-----|------|
| 📖 **分级阅读** | 预置难度分级的精选文章（L1/L2/L3），涵盖职场、日常、科技等场景 |
| 🎧 **听读模式** | TTS 语音朗读，边听边读，多感官学习 |
| 🔍 **即点查词** | 点击单词立即显示中英文释义，不打断阅读节奏 |
| 🤖 **AI 问答** | 基于当前文章内容智能问答，深入理解文章含义 |

### 快速开始

#### 环境要求

| 工具 | 版本要求 |
|-----|---------|
| Node.js | ≥ 24.0.0 |
| pnpm | ≥ 10.0.0 |
| PostgreSQL | ≥ 15 |
| Redis | 最新版 |

#### 本地开发

**步骤 1：克隆项目**

```bash
git clone <repository-url>
cd elynd
```

**步骤 2：安装依赖**

```bash
pnpm install
```

**步骤 3：配置环境变量**

```bash
# 后端配置
cp backend/.env.example backend/.env
# 编辑 backend/.env，配置数据库连接等信息

# 前端配置
cp web/.env.example web/.env
```

**步骤 4：启动数据库（可选：使用 Docker）**

```bash
# 使用 Docker 启动 PostgreSQL 和 Redis
docker-compose -f docker-compose.dev.yml up -d
```

**步骤 5：初始化数据库**

```bash
cd backend
node ace migration:run
```

**步骤 6：启动开发服务器**

```bash
# 终端 1：启动后端 (http://localhost:3335)
pnpm run dev:backend

# 终端 2：启动前端 (http://localhost:3000)
pnpm run dev:web
```

启动完成后，打开浏览器访问 **http://localhost:3000** 即可使用。

### Docker 部署

#### 生产环境部署

**步骤 1：配置环境变量**

```bash
# 后端生产配置
cp backend/.env.example backend/.env
# 编辑 backend/.env，设置生产环境参数：
# - NODE_ENV=production
# - DB_HOST=你的数据库地址
# - REDIS_HOST=你的Redis地址
# - APP_KEY=（运行 node ace generate:key 生成）
```

**步骤 2：构建并启动容器**

```bash
# 使用 Docker Compose 构建并启动
docker-compose -f docker-compose.prod.yml up -d --build
```

**步骤 3：初始化数据库（首次部署）**

```bash
# 进入容器执行迁移
docker exec -it elynd-server sh
node ace migration:run
exit
```

#### 部署参数说明

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `PORT` | 后端服务端口 | `3335` |
| `DB_HOST` | PostgreSQL 地址 | `postgres` |
| `DB_PORT` | PostgreSQL 端口 | `5432` |
| `DB_USER` | 数据库用户名 | `root` |
| `DB_PASSWORD` | 数据库密码 | `your_password` |
| `DB_DATABASE` | 数据库名称 | `app` |
| `REDIS_HOST` | Redis 地址 | `redis` |
| `APP_KEY` | 应用密钥 | （必需） |

### 常见问题

**Q: 启动失败，提示数据库连接失败？**

A: 请确认 PostgreSQL 已启动，并检查 `.env` 中的数据库配置是否正确。

**Q: TTS 语音无法播放？**

A: 需要配置 Azure Speech API 密钥（`TTS_API_KEY` 和 `TTS_REGION`）。如未配置，系统将使用备用方案。

**Q: 如何查看服务状态？**

A: 后端服务健康检查：`http://localhost:3335/health`

---

<p align="center">
  <strong>Elynd</strong><br>
  AI-Powered English Learning
</p>
