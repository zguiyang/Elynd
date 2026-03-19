import { test } from '@japa/runner'
import AuthMiddleware from '#middleware/auth_middleware'

test.group('AuthMiddleware', () => {
  test('认证成功时调用 next', async ({ assert }) => {
    let nextCalled = false

    const ctx = {
      auth: {
        authenticateUsing: async () => {},
      },
    } as any

    const middleware = new AuthMiddleware()
    await middleware.handle(ctx, async () => {
      nextCalled = true
    })

    assert.isTrue(nextCalled)
  })

  test('认证失败时抛出 401', async ({ assert }) => {
    const ctx = {
      auth: {
        authenticateUsing: async () => {
          throw new Error('invalid token')
        },
      },
    } as any

    const middleware = new AuthMiddleware()

    await assert.rejects(() => middleware.handle(ctx, async () => {}), /Unauthenticated/)
  })

  test('不会读取 query token 注入 authorization header', async ({ assert }) => {
    const headers: Record<string, string> = {}
    const ctx = {
      request: {
        input: () => 'query-token-value',
        headers: () => headers,
      },
      auth: {
        authenticateUsing: async () => {},
      },
    } as any

    const middleware = new AuthMiddleware()
    await middleware.handle(ctx, async () => {})

    assert.isUndefined(headers.authorization)
  })
})
