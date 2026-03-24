import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import { SocialAuthService } from '#services/social_auth_service'
import logger from '@adonisjs/core/services/logger'

@inject()
export default class SocialAuthController {
  constructor(private socialAuthService: SocialAuthService) {}

  /**
   * Get OAuth URL for SPA/SFA to redirect
   * GET /auth/:provider/url
   */
  async oauthUrl({ ally, params }: HttpContext) {
    const provider = params.provider
    const url = await ally.use(provider).redirectUrl()
    return { url }
  }

  /**
   * Handle OAuth callback from SPA
   * POST /auth/:provider/callback
   */
  async oauthCallback({ ally, params, request }: HttpContext) {
    const provider = params.provider
    const code = request.input('code')

    if (!code) {
      throw new Exception('Authorization code is required', { status: 400 })
    }

    // Use stateless mode for API callback
    const driver = ally.use(provider).stateless()

    try {
      // Get social user info using the code
      const socialUser = await driver.user()

      logger.info(
        { provider, providerId: socialUser.id, email: socialUser.email },
        'OAuth callback received'
      )

      // Find or create user
      const { user, isNew } = await this.socialAuthService.findOrCreateUserByProvider(
        provider,
        socialUser
      )

      // Generate token
      const rememberMe = request.input('rememberMe', false)
      const token = await this.socialAuthService.generateToken(user, rememberMe)

      return {
        user: user.serialize(),
        token: token.value?.release() ?? '',
        isNew,
      }
    } catch (error) {
      logger.error({ err: error, provider }, 'OAuth callback failed')
      throw new Exception('OAuth authentication failed', { status: 401 })
    }
  }

  /**
   * Server-side redirect to OAuth provider (for traditional server-rendered apps)
   * GET /auth/:provider/redirect
   */
  oauthRedirect({ ally, params }: HttpContext) {
    const provider = params.provider
    return ally.use(provider).redirect()
  }
}
