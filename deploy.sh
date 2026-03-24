#!/bin/bash

# 遇到错误立即停止
set -e

# 配置变量
REMOTE_HOST="prod-deploy-server"
REMOTE_PATH="/opt/1panel/www/sites/elynd.zhaoguiyang.com/index"
BACKEND_BUILD_PATH="backend/build"
WEB_BUILD_PATH="web/dist"

echo "🚀 开始部署 Elynd..."

# ========================================
# 询问是否需要重建 Docker 镜像
# ========================================
echo "========================================"
echo "🤔 是否需要重建 Docker 镜像？"
echo ""
echo "   一般情况选择 [n]，只有以下情况选择 [y]："
echo "   - 首次部署"
echo "   - 修改了 Dockerfile"
echo "   - 修改了 pnpm-lock.yaml"
echo "   - 修改了 docker-compose.prod.yml"
echo "========================================"
read -p "请选择 [y/N]: " rebuild

# ========================================
# 步骤 1: 执行构建
# ========================================
echo "📦 执行 pnpm build..."
pnpm build

# 2. 后端特殊处理：复制环境变量到 build 目录
if [ -f "backend/.env.production" ]; then
    echo "📝 正在复制 backend/.env.production 到 build 目录..."
    cp backend/.env.production "$BACKEND_BUILD_PATH/.env"
else
    echo "⚠️ 未发现 backend/.env.production，请确保服务端 build 目录下已存在 .env.production 文件"
fi

# 3. 前端特殊处理：复制环境变量到 dist 目录
if [ -f "web/.env.production" ]; then
    echo "📝 正在复制 web/.env.production 到 dist 目录..."
    cp web/.env.production "$WEB_BUILD_PATH/.env"
else
    echo "⚠️ 未发现 web/.env.production，请确保服务端 web 目录下已存在 .env.production 文件"
fi

# 4. 同步文件到服务器
echo "📤 同步文件到服务器..."

echo "🔍 检查本地构建产物..."
ls -ld "$BACKEND_BUILD_PATH" "$WEB_BUILD_PATH"

# 创建远程目录结构
echo "📁 正在远程创建目录: $REMOTE_PATH"
ssh "$REMOTE_HOST" "mkdir -p $REMOTE_PATH"

# 备份远端 storage（用户数据：书籍、音频等）
echo "📦 备份远端用户数据..."
ssh "$REMOTE_HOST" "mkdir -p /tmp/elynd_backup && cp -r $REMOTE_PATH/backend/storage /tmp/elynd_backup/ 2>/dev/null || true"

# 同步后端构建产物（不使用 --delete，避免删除用户数据）
echo "--- 同步 Backend ---"
ssh "$REMOTE_HOST" "mkdir -p $REMOTE_PATH/backend"
rsync -avz --omit-dir-times --progress "$BACKEND_BUILD_PATH/" "$REMOTE_HOST:$REMOTE_PATH/backend"

# 还原 storage
echo "📦 还原远端用户数据..."
ssh "$REMOTE_HOST" "cp -r /tmp/elynd_backup/storage $REMOTE_PATH/backend/ 2>/dev/null || true"
ssh "$REMOTE_HOST" "rm -rf /tmp/elynd_backup"

# 同步前端构建产物
echo "--- 同步 Web ---"
ssh "$REMOTE_HOST" "mkdir -p $REMOTE_PATH/web"
rsync -avz --omit-dir-times --progress "$WEB_BUILD_PATH/" "$REMOTE_HOST:$REMOTE_PATH/web"

# 同步项目配置文件
echo "--- 同步项目配置文件 ---"
rsync -avz --progress package.json "$REMOTE_HOST:$REMOTE_PATH/"
rsync -avz --progress pnpm-workspace.yaml "$REMOTE_HOST:$REMOTE_PATH/"
rsync -avz --progress pnpm-lock.yaml "$REMOTE_HOST:$REMOTE_PATH/"
rsync -avz --progress Dockerfile "$REMOTE_HOST:$REMOTE_PATH/"
rsync -avz --progress docker-compose.prod.yml "$REMOTE_HOST:$REMOTE_PATH/"

echo "✅ 文件同步完成!"

# ========================================
# 步骤 5: 根据选择决定是否重建镜像
# ========================================
if [ "$rebuild" = "y" ] || [ "$rebuild" = "Y" ]; then
    echo "🛑 停止并删除现有容器..."
    ssh "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose -f docker-compose.prod.yml down || true"
    
    echo "🐳 重建 Docker 镜像..."
    ssh "$REMOTE_HOST" "cd $REMOTE_PATH && docker build -t elynd ."
else
    echo "⏭️ 跳过镜像构建，使用现有镜像"
fi

# ========================================
# 步骤 6: 启动多容器
# ========================================
echo "🚀 启动多容器..."
ssh "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose -f docker-compose.prod.yml down || true"
echo "🧹 清理远端旧依赖（容器启动时会自动处理，仅清理残留）..."
ssh "$REMOTE_HOST" "rm -rf $REMOTE_PATH/node_modules 2>/dev/null || true"
ssh "$REMOTE_HOST" "cd $REMOTE_PATH && docker compose -f docker-compose.prod.yml up -d"

echo "✨ 部署完成!"

# 显示容器状态
echo "📋 容器状态:"
ssh "$REMOTE_HOST" "docker ps --filter 'name=elynd'"
