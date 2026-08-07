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

const AuthController = () => import('#controllers/auth_controller')

router.get('/', async () => {
  return { ok: true }
})

router
  .group(() => {
    router.post('register', [AuthController, 'register'])
    router.post('login', [AuthController, 'login'])
    router.delete('logout', [AuthController, 'logout']).use(middleware.auth())
    router.get('me', [AuthController, 'me']).use(middleware.auth())

    router.get('email/verify', [AuthController, 'verifyEmail']).as('auth.email_verify_get')
    router.post('email/verify', [AuthController, 'verifyEmail']).as('auth.email_verify_post')
    router.post('email/resend', [AuthController, 'resendVerification'])

    router.post('password/forgot', [AuthController, 'forgotPassword'])
    router.post('password/reset', [AuthController, 'resetPassword'])
  })
  .prefix('/api/v1/auth')
