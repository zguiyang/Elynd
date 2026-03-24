import { inject } from '@adonisjs/core'
import User from '#models/user'
import logger from '@adonisjs/core/services/logger'

interface SocialUser {
  id: string | number
  email: string | null
  name: string
  nickName: string
  avatarUrl: string | null
  emailVerificationState: 'verified' | 'unverified' | 'unsupported'
  token: {
    token: string
    type: string
    [key: string]: unknown
  }
  original: unknown
}

@inject()
export class SocialAuthService {
  /**
   * Find or create user by social login provider
   */
  async findOrCreateUserByProvider(
    provider: string,
    socialUser: SocialUser
  ): Promise<{ user: User; isNew: boolean }> {
    // Try to find by provider + provider_id first
    let user = await User.findBy('provider_id', String(socialUser.id))

    // If not found, try by email (if email is available and not taken by another user)
    if (!user && socialUser.email) {
      const existingByEmail = await User.findBy('email', socialUser.email)
      if (existingByEmail && !existingByEmail.provider) {
        // Link existing email-only account to social provider
        existingByEmail.provider = provider
        existingByEmail.providerId = String(socialUser.id)
        await existingByEmail.save()
        user = existingByEmail
        logger.info({ userId: user.id, provider }, 'Linked existing user to social provider')
        return { user, isNew: false }
      }
    }

    // Create new user if not found
    if (!user) {
      const email = socialUser.email || `${provider}_${socialUser.id}@placeholder.local`
      user = await User.create({
        email,
        fullName: socialUser.name,
        avatar: socialUser.avatarUrl,
        provider,
        providerId: String(socialUser.id),
        password: '', // No password for social login users
      })
      logger.info({ userId: user.id, provider }, 'Created new user via social provider')
    }

    return { user, isNew: !user.$isPersisted }
  }

  /**
   * Generate access token for API authentication
   */
  async generateToken(user: User, rememberMe: boolean = false) {
    const expiresIn = rememberMe ? '30 days' : '7 days'
    return await User.accessTokens.create(user, ['*'], { expiresIn })
  }
}
