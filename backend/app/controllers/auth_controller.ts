import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import {
  loginValidator,
  registerValidator,
  resetPasswordValidator,
  forgotPasswordValidator,
} from '#validators/auth_validator'
import { AuthService } from '#services/auth_service'

@inject()
export default class AuthController {
  constructor(private authService: AuthService) {}

  async register({ request }: HttpContext) {
    const data = await request.validateUsing(registerValidator)
    const { user, token } = await this.authService.register(data)

    return {
      user: user.serialize(),
      token: token.value?.release() ?? '',
    }
  }

  async login({ request }: HttpContext) {
    const data = await request.validateUsing(loginValidator)
    const { user, token } = await this.authService.login(data.email, data.password, data.rememberMe)

    return {
      user: user.serialize(),
      token: token.value?.release() ?? '',
    }
  }

  async logout({ auth }: HttpContext) {
    await auth.use('api').invalidateToken()
  }

  async forgotPassword({ request }: HttpContext) {
    const data = await request.validateUsing(forgotPasswordValidator)

    return await this.authService.requestPasswordReset(data.email)
  }

  async resetPassword({ request }: HttpContext) {
    const data = await request.validateUsing(resetPasswordValidator)
    await this.authService.resetPassword(data.token, data.password)
  }
}
