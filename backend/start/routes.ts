/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/
import fs from 'node:fs/promises'
import path from 'node:path'
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import env from '#start/env'
import transmit from '@adonisjs/transmit/services/main'
import { apiLimiter, authLimiter } from '#start/limiter'

const AuthController = () => import('#controllers/auth_controller')
const UsersController = () => import('#controllers/users_controller')

// 公开认证路 由组（不需要认证）- 更严格的限流
router
  .group(() => {
    router.post('/auth/register', [AuthController, 'register'])
    router.post('/auth/login', [AuthController, 'login'])
    router.post('/auth/forgot-password', [AuthController, 'forgotPassword'])
    router.post('/auth/reset-password', [AuthController, 'resetPassword'])
  })
  .prefix('api')
  .use(authLimiter)

// 受保护 API 路由组（需要认证）
router
  .group(() => {
    router.post('/auth/logout', [AuthController, 'logout'])

    // 用户 API
    router.get('/user/me', [UsersController, 'me'])
    router.put('/user', [UsersController, 'update'])
    router.post('/user/avatar', [UsersController, 'uploadAvatar'])
    router.delete('/user/avatar', [UsersController, 'removeAvatar'])

    // 标签 API
    // router.get('/tags', [TagsController, 'index'])
    // router.get('/tags/:id', [TagsController, 'show'])
    // router.get('/tags/:id/items', [TagsController, 'items'])
    // router.post('/tags', [TagsController, 'store'])
    // router.put('/tags/:id', [TagsController, 'update'])
    // router.delete('/tags/:id', [TagsController, 'destroy'])

    // 书签 API
    // router.get('/bookmarks', [BookmarksController, 'index'])
    // router.get('/bookmarks/paginate', [BookmarksController, 'paginate'])
    // router.get('/bookmarks/fetching-count', [BookmarksController, 'fetchingCount'])
    // router.get('/bookmarks/:id', [BookmarksController, 'show'])
    // router.post('/bookmarks', [BookmarksController, 'store'])
    // router.post('/bookmarks/by-url', [BookmarksController, 'createByUrl'])
    // router.post('/bookmarks/:id/refresh-metadata', [BookmarksController, 'refreshMetadata'])
    // router.post('/bookmarks/:id/visit', [BookmarksController, 'recordVisit'])
    // router.post('/bookmarks/import', [BookmarksController, 'import'])
    // router.get('/bookmarks/import/:jobId/status', [BookmarksController, 'importStatus'])
    // router.put('/bookmarks/:id', [BookmarksController, 'update'])
    // router.delete('/bookmarks/:id', [BookmarksController, 'destroy'])

    // 备忘录 API
    // router.get('/memos', [MemosController, 'index'])
    // router.get('/memos/paginate', [MemosController, 'paginate'])
    // router.get('/memos/:id', [MemosController, 'show'])
    // router.post('/memos', [MemosController, 'store'])
    // router.put('/memos/:id', [MemosController, 'update'])
    // router.delete('/memos/:id', [MemosController, 'destroy'])

    // 设置 API
    // router.get('/settings/ai', [SettingsController, 'getAiConfig'])
    // router.put('/settings/ai', [SettingsController, 'updateAiConfig'])

    // AI API - 独立限流
    // router.get('/ai/config', [AiController, 'getConfig'])
    // router.post('/ai/chat', [AiController, 'chat']).use(aiChatLimiter)
    // router.post('/ai/chat/stream', [AiController, 'stream']).use(aiChatLimiter)

    // 全局搜索 - 独立限流
    // router.get('/search', [SearchController, 'search']).use(searchLimiter)
  })
  .prefix('api')
  .middleware(middleware.auth())
  .use(apiLimiter)

// Jobs Dashboard（GUI 界面）- 仅管理员可访问
router.jobs('/jobs').use(async (ctx, next) => {
  if (env.get('NODE_ENV') === 'development') {
    return next()
  }

  const adminSecret = env.get('ADMIN_SECRET')

  if (!adminSecret) {
    return ctx.response.forbidden({ errors: [{ message: 'Dashboard access not configured' }] })
  }

  const requestSecret = ctx.request.header('x-admin-secret')

  if (requestSecret !== adminSecret) {
    return ctx.response.forbidden({ errors: [{ message: 'Access denied' }] })
  }

  return next()
})

// Register Transmit routes (no auth middleware needed for events endpoint)
// Authorization is handled by transmit.authorize() for each channel
transmit.registerRoutes()

// Configure channel authorization
// TODO: Replace with actual channel authorization when needed
transmit.authorize('placeholder:userId', (ctx, { userId }) => {
  if (!ctx.auth.isAuthenticated) {
    return false
  }
  return Number(ctx.auth.user?.id) === Number(userId)
})

router.get('/avatars/:filename', async ({ params, response }) => {
  const filename = params.filename
  const filepath = path.resolve(process.cwd(), 'storage', 'avatars', filename)

  try {
    const stat = await fs.stat(filepath)
    if (!stat.isFile()) {
      return response.notFound({ error: 'Avatar not found' })
    }
    return response.download(filepath)
  } catch {
    return response.notFound({ error: 'Avatar not found' })
  }
})
