import { test } from '@japa/runner'
import UserConfig from '#models/user_config'
import { bearerAuthHeader, createAuthenticatedUser, makeForwardedFor } from '#tests/helpers/auth'

test.group('Users API contract', () => {
  test('GET /api/user/me returns the authenticated user and PUT /api/user updates the profile', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Profile User',
      emailPrefix: 'profile',
      password: 'password123',
    })

    cleanup(async () => {
      await user.delete()
    })

    const meResponse = await client
      .get('/api/user/me')
      .header('Authorization', bearerAuthHeader(token))

    meResponse.assertStatus(200)
    assert.equal(meResponse.body().id, user.id)
    assert.equal(meResponse.body().email, user.email)

    const updateResponse = await client
      .put('/api/user')
      .header('Authorization', bearerAuthHeader(token))
      .json({
        fullName: 'Updated Profile User',
      })

    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().fullName, 'Updated Profile User')

    await user.refresh()
    assert.equal(user.fullName, 'Updated Profile User')
  })

  test('POST /api/user/change-password invalidates the old password and accepts the new one', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Profile User',
      emailPrefix: 'profile',
      password: 'password123',
    })

    cleanup(async () => {
      await user.delete()
    })

    const changePasswordResponse = await client
      .post('/api/user/change-password')
      .header('Authorization', bearerAuthHeader(token))
      .json({
        currentPassword: 'password123',
        newPassword: 'new-password123',
      })

    changePasswordResponse.assertStatus(200)

    const oldTokenAccessResponse = await client
      .get('/api/user/me')
      .header('Authorization', bearerAuthHeader(token))

    oldTokenAccessResponse.assertStatus(401)
    assert.isTrue(oldTokenAccessResponse.body().error)
    assert.equal(oldTokenAccessResponse.body().message, 'Unauthenticated')

    const oldPasswordLoginResponse = await client
      .post('/api/auth/login')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        email: user.email,
        password: 'password123',
        rememberMe: false,
      })

    oldPasswordLoginResponse.assertStatus(400)

    const newPasswordLoginResponse = await client
      .post('/api/auth/login')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        email: user.email,
        password: 'new-password123',
        rememberMe: false,
      })

    newPasswordLoginResponse.assertStatus(200)
  })

  test('GET /api/user/config auto-creates defaults and PUT /api/user/config updates only submitted fields', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Profile User',
      emailPrefix: 'profile',
      password: 'password123',
    })

    cleanup(async () => {
      await UserConfig.query().where('userId', user.id).delete()
      await user.delete()
    })

    const initialResponse = await client
      .get('/api/user/config')
      .header('Authorization', bearerAuthHeader(token))

    initialResponse.assertStatus(200)
    assert.equal(initialResponse.body().nativeLanguage, 'zh')
    assert.equal(initialResponse.body().targetLanguage, 'en')
    assert.equal(initialResponse.body().vocabularyLevel, 'beginner')
    assert.isFalse(initialResponse.body().learningInitCompleted)

    const configCountAfterGet = await UserConfig.query().where('userId', user.id)
    assert.lengthOf(configCountAfterGet, 1)

    const updateResponse = await client
      .put('/api/user/config')
      .header('Authorization', bearerAuthHeader(token))
      .json({
        englishVariant: 'en-GB',
        learningInitCompleted: true,
      })

    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().nativeLanguage, 'zh')
    assert.equal(updateResponse.body().targetLanguage, 'en')
    assert.equal(updateResponse.body().vocabularyLevel, 'beginner')
    assert.equal(updateResponse.body().englishVariant, 'en-GB')
    assert.isTrue(updateResponse.body().learningInitCompleted)

    const configCountAfterUpdate = await UserConfig.query().where('userId', user.id)
    assert.lengthOf(configCountAfterUpdate, 1)
  })
})
