import app from '@adonisjs/core/services/app'
import { defineConfig, services } from '@adonisjs/drive'

const driveConfig = defineConfig({
  default: 'fs' as const,

  services: {
    fs: services.fs({
      location: app.makePath('storage'),
      serveFiles: true,
      routeBasePath: '/static',
      visibility: 'public',
    }),
  },
})

export default driveConfig
