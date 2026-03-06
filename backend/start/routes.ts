/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import env from '#start/env'
import transmit from '@adonisjs/transmit/services/main'
import { apiLimiter, authLimiter, aiChatLimiter } from '#start/limiter'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const AuthController = () => import('#controllers/auth_controller')
const UsersController = () => import('#controllers/users_controller')
const ArticlesController = () => import('#controllers/articles_controller')
const ArticleChatController = () => import('#controllers/article_chat_controller')
const DictionaryController = () => import('#controllers/dictionary_controller')
const AdminArticlesController = () => import('#controllers/admin/articles_controller')
const AdminSystemConfigsController = () => import('#controllers/admin/system_configs_controller')

// ===== 公开路由组 (需要限流) =====
router
  .group(() => {
    router.post('/auth/register', [AuthController, 'register'])
    router.post('/auth/login', [AuthController, 'login'])
    router.post('/auth/forgot-password', [AuthController, 'forgotPassword'])
    router.post('/auth/reset-password', [AuthController, 'resetPassword'])
  })
  .prefix('api')
  .use(authLimiter)

// ===== 受保护路由组 (需要认证 + 通用限流) =====
router
  .group(() => {
    // Auth
    router.post('/auth/logout', [AuthController, 'logout'])

    // User
    router.get('/user/me', [UsersController, 'me'])
    router.put('/user', [UsersController, 'update'])
    router.post('/user/change-password', [UsersController, 'changePassword'])
    router.get('/user/config', [UsersController, 'getConfig'])
    router.put('/user/config', [UsersController, 'updateConfig'])

    // Articles
    router.get('/articles', [ArticlesController, 'index'])
    router.get('/articles/:id', [ArticlesController, 'show'])
    router.get('/articles/:id/chapters/:chapterIndex', [ArticlesController, 'chapter'])
    router.get('/articles/:id/vocabulary', [ArticlesController, 'vocabulary'])
    router.get('/tags', [ArticlesController, 'tags'])
    router.post('/articles/:id/ai-chat', [ArticlesController, 'aiChat']).use(aiChatLimiter)
    router.get('/articles/:id/chats', [ArticleChatController, 'chat'])

    // Dictionary
    router.get('/dictionary/:word', [DictionaryController, 'lookup'])
  })
  .prefix('api')
  .middleware(middleware.auth())
  .use(apiLimiter)

// ===== 管理员路由组 (需要认证 + 管理员权限) =====
router
  .group(() => {
    router.post('/admin/articles/generate', [AdminArticlesController, 'generate'])
    router.post('/admin/articles/:id/retry-audio', [AdminArticlesController, 'retryAudio'])
    router.get('/admin/system-config', [AdminSystemConfigsController, 'index'])
    router.put('/admin/system-config', [AdminSystemConfigsController, 'update'])
  })
  .prefix('api')
  .middleware([middleware.auth(), middleware.admin()])

// ===== Jobs Dashboard (仅开发环境或需要密钥) =====
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

// ===== Transmit WebSocket 路由 =====
transmit.registerRoutes()

transmit.authorize('user:userId:article', (ctx, { userId }) => {
  if (!ctx.auth.isAuthenticated) {
    return false
  }
  return Number(ctx.auth.user?.id) === Number(userId)
})

// ===== 静态资源路由 =====
router.get('/audio/articles/:id', async ({ params, response }) => {
  const articleId = params.id
  const storageDir = join(process.cwd(), 'storage', 'article', 'voices')
  const filePath = join(storageDir, `${articleId}.mp3`)

  try {
    const fileBuffer = await readFile(filePath)
    response.header('Content-Type', 'audio/mpeg')
    response.header('Content-Disposition', `inline; filename="article-${articleId}.mp3"`)
    return response.send(fileBuffer)
  } catch {
    return response.notFound({ error: 'Audio file not found' })
  }
})
