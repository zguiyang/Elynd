/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import app from '@adonisjs/core/services/app';
import router from '@adonisjs/core/services/router';
import openapi from '@foadonis/openapi/services/main';

import { middleware } from '#start/kernel';

const AuthController = () => import('#controllers/auth_controller');

router.get('/', async () => {
  return { ok: true };
});

router
  .group(() => {
    router.post('register', [AuthController, 'register']);
    router.post('login', [AuthController, 'login']);
    router.delete('logout', [AuthController, 'logout']);
    router.get('me', [AuthController, 'me']).use(middleware.auth({ guards: ['web'] }));

    router.get('email/verify', [AuthController, 'verifyEmail']).as('auth.email_verify_get');
    router.post('email/verify', [AuthController, 'verifyEmail']).as('auth.email_verify_post');
    router.post('email/resend', [AuthController, 'resendVerification']);

    router.post('password/forgot', [AuthController, 'forgotPassword']);
    router.post('password/reset', [AuthController, 'resetPassword']);
  })
  .prefix('/api/auth');

/**
 * Swagger UI (non-production). Closure handlers are not scanned into the spec.
 * UI: /api-docs · Spec: /api-docs.json
 */
if (!app.inProduction) {
  router.get('/api-docs', async ({ response }) => {
    return response.header('Content-Type', 'text/html').send(openapi.generateUi('/api-docs.json'));
  });

  router.get('/api-docs.json', async ({ response }) => {
    return response.json(await openapi.buildDocument());
  });
}
