import { test } from '@japa/runner'
import User from '#models/user'
import { bearerAuthHeader, makeForwardedFor, makeTestEmail } from '#tests/helpers/auth'

test.group('Auth API contract', () => {
  test('POST /api/auth/register creates a user and returns an access token', async ({
    assert,
    client,
    cleanup,
  }) => {
    const email = makeTestEmail('register-user')

    const response = await client
      .post('/api/auth/register')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        email,
        name: 'Register User',
        password: 'password123',
      })

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.user.email, email)
    assert.equal(body.user.fullName, 'Register User')
    assert.isBoolean(body.user.isAdmin)
    assert.isString(body.token)
    assert.isAbove(body.token.length, 0)

    const user = await User.findByOrFail('email', email)
    cleanup(async () => {
      await user.delete()
    })
  })

  test('POST /api/auth/register rejects duplicate email addresses', async ({ client, cleanup }) => {
    const email = makeTestEmail('duplicate-user')

    const user = await User.create({
      fullName: 'Existing User',
      email,
      password: 'password123',
    })

    cleanup(async () => {
      await user.delete()
    })

    const response = await client
      .post('/api/auth/register')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        email,
        name: 'Duplicate User',
        password: 'password123',
      })

    response.assertStatus(422)
  })

  test('POST /api/auth/login returns a token and GET /api/user/me accepts it until POST /api/auth/logout invalidates it', async ({
    assert,
    client,
    cleanup,
  }) => {
    const email = makeTestEmail('login-user')
    const password = 'password123'

    const user = await User.create({
      fullName: 'Login User',
      email,
      password,
      isAdmin: false,
    })

    cleanup(async () => {
      await user.delete()
    })

    const loginResponse = await client
      .post('/api/auth/login')
      .header('x-forwarded-for', makeForwardedFor())
      .json({
        email,
        password,
        rememberMe: false,
      })

    loginResponse.assertStatus(200)

    const loginBody = loginResponse.body()
    assert.equal(loginBody.user.id, user.id)
    assert.equal(loginBody.user.email, email)
    assert.isString(loginBody.token)
    assert.isAbove(loginBody.token.length, 0)

    const meBeforeLogoutResponse = await client
      .get('/api/user/me')
      .header('Authorization', bearerAuthHeader(loginBody.token))

    meBeforeLogoutResponse.assertStatus(200)
    assert.equal(meBeforeLogoutResponse.body().id, user.id)

    const logoutResponse = await client
      .post('/api/auth/logout')
      .header('Authorization', bearerAuthHeader(loginBody.token))

    logoutResponse.assertStatus(200)

    const meAfterLogoutResponse = await client
      .get('/api/user/me')
      .header('Authorization', bearerAuthHeader(loginBody.token))

    meAfterLogoutResponse.assertStatus(401)
  })
})
