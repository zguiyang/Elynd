import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'

export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!ctx.auth.isAuthenticated) {
      throw new Exception('Unauthenticated', { status: 401 })
    }

    if (!ctx.auth.user?.isAdmin) {
      throw new Exception('Forbidden: Admin access required', { status: 403 })
    }

    return next()
  }
}
