FROM node:24-alpine
RUN npm install -g pnpm

WORKDIR /app
COPY backend/ ./backend/

WORKDIR /app/backend
RUN pnpm install --prod

WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production

# 端口配置
ENV PORT=3335
EXPOSE ${PORT}

# 健康检查 - 进程级
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)"

CMD ["node", "backend/bin/server.js"]
