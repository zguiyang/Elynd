import crypto from 'node:crypto'
import User from '#models/user'

interface CreateTestUserOptions {
  fullName?: string
  emailPrefix?: string
  password?: string
  isAdmin?: boolean
}

interface AuthenticatedUserResult {
  user: User
  token: string
}

function makeTestEmail(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}@example.com`
}

function makeForwardedFor() {
  return `10.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`
}

async function createAuthenticatedUser(
  options: CreateTestUserOptions = {}
): Promise<AuthenticatedUserResult> {
  const {
    fullName = 'Test User',
    emailPrefix = 'user',
    password = 'testpassword123',
    isAdmin = false,
  } = options

  const user = await User.create({
    fullName,
    email: makeTestEmail(emailPrefix),
    password,
    isAdmin,
  })

  const token = await User.accessTokens.create(user, ['*'], { expiresIn: '1 day' })

  return { user, token: token.value!.release() }
}

function bearerAuthHeader(token: string) {
  return `Bearer ${token}`
}

export { bearerAuthHeader, createAuthenticatedUser, makeForwardedFor, makeTestEmail }
export type { AuthenticatedUserResult, CreateTestUserOptions }
