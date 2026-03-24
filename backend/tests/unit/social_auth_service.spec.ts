import { test } from '@japa/runner'
import User from '#models/user'
import { SocialAuthService } from '#services/social_auth_service'
import { makeTestEmail } from '#tests/helpers/auth'

test.group('SocialAuthService', (group) => {
  let socialAuthService: SocialAuthService
  const testEmail = makeTestEmail('social-auth')

  group.each.setup(() => {
    socialAuthService = new SocialAuthService()
  })

  test('findOrCreateUserByProvider creates new user when not exists', async ({ assert }) => {
    const socialUser = {
      id: 12345,
      email: testEmail,
      name: 'Test User',
      nickName: 'testuser',
      avatarUrl: 'https://example.com/avatar.png',
      emailVerificationState: 'verified' as const,
      token: { token: 'abc', secret: 'def', type: 'bearer' as const },
      original: {},
    }

    const { user, isNew } = await socialAuthService.findOrCreateUserByProvider('github', socialUser)

    assert.isTrue(isNew)
    assert.equal(user.email, testEmail)
    assert.equal(user.fullName, 'Test User')
    assert.equal(user.provider, 'github')
    assert.equal(user.providerId, '12345')

    // Cleanup
    await user.delete()
  })

  test('findOrCreateUserByProvider finds existing user by provider_id', async ({ assert }) => {
    const email = makeTestEmail('existing-social-user')

    // Create user first
    const existingUser = await User.create({
      email,
      fullName: 'Existing User',
      provider: 'github',
      providerId: '99999',
      password: '',
    })

    const socialUser = {
      id: 99999,
      email,
      name: 'Existing User',
      nickName: 'existing',
      avatarUrl: null,
      emailVerificationState: 'verified' as const,
      token: { token: 'abc', secret: 'def', type: 'bearer' as const },
      original: {},
    }

    const { user, isNew } = await socialAuthService.findOrCreateUserByProvider('github', socialUser)

    assert.isFalse(isNew)
    assert.equal(user.id, existingUser.id)

    // Cleanup
    await existingUser.delete()
  })

  test('findOrCreateUserByProvider links existing email user to social provider', async ({
    assert,
  }) => {
    const email = makeTestEmail('link-social-user')

    // Create user without provider
    const existingUser = await User.create({
      email,
      fullName: 'Link User',
      password: 'hashedpassword',
    })

    const socialUser = {
      id: 88888,
      email,
      name: 'Link User',
      nickName: 'linkuser',
      avatarUrl: null,
      emailVerificationState: 'verified' as const,
      token: { token: 'abc', secret: 'def', type: 'bearer' as const },
      original: {},
    }

    const { user, isNew } = await socialAuthService.findOrCreateUserByProvider('github', socialUser)

    assert.isFalse(isNew)
    assert.equal(user.id, existingUser.id)
    assert.equal(user.provider, 'github')
    assert.equal(user.providerId, '88888')

    // Cleanup
    await existingUser.delete()
  })

  test('generateToken creates access token for user', async ({ assert }) => {
    const email = makeTestEmail('token-social-user')

    const user = await User.create({
      email,
      fullName: 'Token User',
      password: '',
    })

    const token = await socialAuthService.generateToken(user, false)

    assert.isString(token.value?.release())
    assert.isAbove(token.value?.release().length ?? 0, 0)

    // Cleanup
    await user.delete()
  })

  test('generateToken with rememberMe sets longer expiration', async ({ assert }) => {
    const email = makeTestEmail('remember-token-user')

    const user = await User.create({
      email,
      fullName: 'Remember User',
      password: '',
    })

    const token = await socialAuthService.generateToken(user, true)

    assert.isString(token.value?.release())
    assert.isAbove(token.value?.release().length ?? 0, 0)

    // Cleanup
    await user.delete()
  })
})
