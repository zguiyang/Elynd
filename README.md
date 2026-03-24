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

### 截图展示

| 页面 | 截图 |
|-----|------|
| 落地页 | ![落地页](https://cloud.zgyk.cc/f/rLUd/%E8%90%BD%E5%9C%B0%E9%A1%B5.png) |
| 学习页 | ![学习页](https://cloud.zgyk.cc/f/mksY/%E5%AD%A6%E4%B9%A0%E9%A1%B5.png) |
| 阅读页 | ![阅读页](https://cloud.zgyk.cc/f/EMIP/%E9%98%85%E8%AF%BB%E9%A1%B5.png) |
| 双语阅读模式 | ![双语阅读模式](https://cloud.zgyk.cc/f/oxiD/%E5%8F%8C%E8%AF%AD%E9%98%85%E8%AF%BB.png) |

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

> **部署须知**
>
> 本项目依赖 AI 模型服务与 TTS（文本转语音）服务：
> - **AI 模型**：采用 OpenAI 格式的 API，后续将扩展支持更多提供商
> - **TTS 服务**：目前仅支持 Azure TTS，后续将扩展更多选项
>
> 部署完成后，**首个注册用户将自动成为管理员**。进入系统后，请先在管理后台配置 AI 服务。

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
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | （OAuth 登录必需） |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | （OAuth 登录必需） |
| `GITHUB_CALLBACK_URL` | OAuth 回调地址 | `https://你的域名/auth/callback/github` |

#### OAuth 登录配置

本系统支持 GitHub OAuth 登录，需要在 GitHub 开发者设置中创建 OAuth App。

**步骤 1：创建 GitHub OAuth App**

1. 登录 GitHub → Settings → Developer settings → OAuth Apps
2. 点击 "New OAuth App"
3. 填写信息：
   - **Application name**: Elynd
   - **Homepage URL**: `https://你的域名`
   - **Authorization callback URL**: `https://你的域名/auth/callback/github`
4. 创建后会获得 `Client ID` 和 `Client Secret`

**步骤 2：配置环境变量**

在 `backend/.env` 中添加：

```env
GITHUB_CLIENT_ID=你的GitHub OAuth App Client ID
GITHUB_CLIENT_SECRET=你的GitHub OAuth App Client Secret
GITHUB_CALLBACK_URL=https://你的域名/auth/callback/github
```

> **回调 URL 说明**
> - 开发环境：`http://localhost:3000/auth/callback/github`
> - 生产环境：`https://你的域名/auth/callback/github`

#### Nginx 配置（域名访问）

如果需要通过域名访问应用，请参考以下 Nginx 配置：

```nginx
# /__transmit/ 路径代理（用于 SSE 实时通信）
location ^~ /__transmit/ {
    proxy_pass http://127.0.0.1:3335;
    proxy_set_header Host $host;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # SSE 关键配置
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}

# /static/ 路径代理（静态资源）
location ^~ /static/ {
    proxy_pass http://127.0.0.1:3335;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # 静态资源长期缓存
    expires 7d;
    add_header Cache-Control "public, immutable";
}

# /api 路径代理（后端 API）
location ^~ /api/ {
    proxy_pass http://127.0.0.1:3335;
    proxy_set_header Host $host;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

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
