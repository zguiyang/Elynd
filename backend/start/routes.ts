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
import { apiLimiter, authLimiter, aiChatLimiter, dictionaryLimiter } from '#start/limiter'

const AuthController = () => import('#controllers/auth_controller')
const SocialAuthController = () => import('#controllers/social_auth_controller')
const UsersController = () => import('#controllers/users_controller')
const BooksController = () => import('#controllers/books_controller')
const BookChatController = () => import('#controllers/book_chat_controller')
const DictionaryController = () => import('#controllers/dictionary_controller')
const WordAudiosController = () => import('#controllers/word_audios_controller')
const AdminBooksController = () => import('#controllers/admin/books_controller')
const AdminSystemConfigsController = () => import('#controllers/admin/system_configs_controller')
const LearningsController = () => import('#controllers/learnings_controller')
const ChapterTranslationsController = () => import('#controllers/chapter_translations_controller')

// ===== 公开路由组 (需要限流) =====
router
  .group(() => {
    router.post('/auth/register', [AuthController, 'register'])
    router.post('/auth/login', [AuthController, 'login'])
    router.post('/auth/forgot-password', [AuthController, 'forgotPassword'])
    router.post('/auth/reset-password', [AuthController, 'resetPassword'])

    // Social Auth (SPA/SFA - 前端分离)
    router.get('/auth/:provider/url', [SocialAuthController, 'oauthUrl'])
    router.post('/auth/:provider/callback', [SocialAuthController, 'oauthCallback'])
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

    // Books
    router.get('/books', [BooksController, 'index'])
    router.get('/books/:id', [BooksController, 'show'])
    router.get('/books/:id/chapters/:chapterIndex', [BooksController, 'chapter'])
    router.get('/books/:id/chapters/:chapterIndex/audio', [BooksController, 'chapterAudio'])
    router.get('/books/:id/vocabulary', [BooksController, 'vocabulary'])
    router.get('/book-levels', [BooksController, 'levels'])
    router.get('/tags', [BooksController, 'tags'])
    router.post('/books/:id/ai-chat', [BooksController, 'aiChat']).use(aiChatLimiter)
    router.get('/books/:id/chats', [BookChatController, 'chat'])
    router.post('/chapters/:chapterId/translations', [ChapterTranslationsController, 'trigger'])
    router.get('/chapters/:chapterId/translations', [ChapterTranslationsController, 'show'])
    router.get('/chapter-translations/:id/status', [ChapterTranslationsController, 'status'])
    router.get('/chapter-translations/:id/progress', [ChapterTranslationsController, 'progress'])
    router.get('/chapter-translations/:id/events', [ChapterTranslationsController, 'events'])

    // Dictionary
    router.get('/dictionary/:word', [DictionaryController, 'lookup']).use(dictionaryLimiter)
    router.get('/word-audio/:word', [WordAudiosController, 'show']).use(dictionaryLimiter)

    // Learning
    router.post('/learning/login', [LearningsController, 'login'])
    router.put('/learning/progress', [LearningsController, 'updateProgress'])
    router.get('/learning/index', [LearningsController, 'index'])
    router.get('/learning/recommend', [LearningsController, 'recommend'])
  })
  .prefix('api')
  .middleware(middleware.auth())
  .use(apiLimiter)

// ===== 管理员路由组 (需要认证 + 管理员权限) =====
router
  .group(() => {
    router.post('/admin/books/:id/retry-audio', [AdminBooksController, 'retryAudio'])
    router.post('/admin/books/:id/retry-vocabulary', [AdminBooksController, 'retryVocabulary'])
    router.post('/admin/books/:id/rebuild-chapters', [AdminBooksController, 'rebuildChapters'])
    router.post('/admin/books/:id/stop-import', [AdminBooksController, 'stopImport'])
    router.post('/admin/books/:id/continue-import', [AdminBooksController, 'continueImport'])
    router.post('/admin/books/import', [AdminBooksController, 'import'])
    router.get('/admin/books', [AdminBooksController, 'index'])
    router.get('/admin/books/:id/status', [AdminBooksController, 'status'])
    router.patch('/admin/books/:id', [AdminBooksController, 'update'])
    router.delete('/admin/books/:id', [AdminBooksController, 'destroy'])
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

transmit.authorize('user:userId:book', (ctx, { userId }) => {
  if (!ctx.auth.isAuthenticated) {
    return false
  }
  return Number(ctx.auth.user?.id) === Number(userId)
})

transmit.authorize('user:userId:book_import', (ctx, { userId }) => {
  if (!ctx.auth.isAuthenticated) {
    return false
  }
  return Number(ctx.auth.user?.id) === Number(userId)
})

// ===== 静态资源路由 =====
router.get('/audio/books/:id', [BooksController, 'bookAudio']).middleware(middleware.auth())
