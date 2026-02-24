import env from '#start/env'
import { defineConfig } from '@adonisjs/transmit'
import { redis } from '@adonisjs/transmit/transports'

export default defineConfig({
  pingInterval: '10s',
  transport: {
    driver: redis({
      host: env.get('REDIS_HOST', '127.0.0.1'),
      port: env.get('REDIS_PORT', 6379),
      db: env.get('REDIS_DB', 0),
      password: env.get('REDIS_PASSWORD') || undefined,
      keyPrefix: 'transmit',
    }),
  },
})
