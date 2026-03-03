import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { Exception } from '@adonisjs/core/exceptions'

export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    try {
      const token = ctx.request.input('token')
      if (token) {
        ctx.request.headers().authorization = `Bearer ${token}`
      }
      await ctx.auth.authenticateUsing(options.guards)
      return next()
    } catch (error) {
      throw new Exception('Unauthenticated', { status: 401 })
    }
  }
}
