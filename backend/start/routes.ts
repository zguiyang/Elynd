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
    router.post('/user/change-password', [UsersController, 'changePassword'])
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
