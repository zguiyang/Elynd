import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'

export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (ctx.auth.user?.isAdmin !== true) {
      throw new Exception('Forbidden: Admin access required', { status: 403 })
    }

    return next()
  }
}
