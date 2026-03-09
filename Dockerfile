FROM node:24-alpine

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production

# 端口配置
ENV PORT=3335
EXPOSE ${PORT}
