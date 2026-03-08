FROM node:24-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY backend/ ./backend/
WORKDIR /app/backend
RUN pnpm install --prod
WORKDIR /app
EXPOSE 3335
CMD ["node", "backend/bin/server.js"]
