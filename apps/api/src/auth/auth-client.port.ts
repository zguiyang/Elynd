export type AuthUser = {
  id: string
  email: string
  name: string
}

export type AuthSession = {
  id: string
  userId: string
  token: string
}

export type RegisterInput = {
  email: string
  password: string
  name: string
}

export type LoginInput = {
  email: string
  password: string
}

export type SessionHeaders = Record<string, string | string[] | undefined>

/** Primary client credential: `Authorization: Bearer <session-token>` */
export type BearerSessionHeaders = SessionHeaders & {
  authorization?: string
}

export type SignUpResult =
  | { ok: true; user: AuthUser; session: AuthSession | null }
  | { ok: false; code: 'DUPLICATE_EMAIL' | 'VALIDATION_ERROR'; message: string }

export type SignInResult =
  | { ok: true; user: AuthUser; session: AuthSession }
  | { ok: false; code: 'INVALID_CREDENTIALS'; message: string }

export type GetSessionResult =
  | { ok: true; user: AuthUser; session: AuthSession }
  | { ok: false }

export interface AuthClientPort {
  signUpEmail(input: RegisterInput): Promise<SignUpResult>
  signInEmail(input: LoginInput): Promise<SignInResult>
  getSession(headers: SessionHeaders): Promise<GetSessionResult>
}

export const AUTH_CLIENT = Symbol('AUTH_CLIENT')
