import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors } from '@vinejs/vine'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof errors.E_VALIDATION_ERROR) {
      const firstField = Object.keys(error.messages)[0]
      const message = error.messages[firstField]?.[0] || '参数验证失败，请检查输入'

      if (!app.inProduction) {
        return ctx.response.status(422).send({
          error: error,
          message: message,
        })
      }

      return ctx.response.status(422).send({
        message: message,
      })
    }

    const getStatus = (err: unknown): number => {
      if (err && typeof err === 'object' && 'status' in err) {
        return (err as { status: number }).status
      }
      return 500
    }

    const getMessage = (err: unknown): string => {
      if (err && typeof err === 'object' && 'message' in err) {
        return (err as { message: string }).message
      }
      return 'Internal Server Error'
    }

    const status = getStatus(error)
    const message = getMessage(error)

    if (app.inProduction) {
      return ctx.response.status(status).send({
        message: message,
      })
    }

    return ctx.response.status(status).send({
      error: error,
      message: message,
    })
  }

  /**
   * The method is used to report error to the logging service or
   * the third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
