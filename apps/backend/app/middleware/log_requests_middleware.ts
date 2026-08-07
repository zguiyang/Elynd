import string from '@adonisjs/core/helpers/string'
import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Logs method, URL, status, and duration for every HTTP request.
 * Uses the app logger (not ctx.logger) so access lines stay free of request_id noise.
 * Status → log level (pretty printer colors): 4xx/5xx error (red), else info.
 * @see https://docs.adonisjs.com/guides/basics/middleware
 */
export default class LogRequestsMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const startTime = process.hrtime()

    try {
      await next()
    } finally {
      const status = response.getStatus()
      const message = `${request.method()} ${request.url()}: ${status} (${string.prettyHrTime(process.hrtime(startTime))})`

      if (status >= 400) {
        logger.error(message)
      } else {
        logger.info(message)
      }
    }
  }
}
