import vine from '@vinejs/vine'
import { type Infer } from '@vinejs/vine/types'
import { VALIDATION } from '#constants'

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim(),
    password: vine.string().minLength(1),
    rememberMe: vine.boolean().optional(),
  })
)

export const registerValidator = vine.compile(
  vine.object({
    email: vine
      .string()
      .email()
      .trim()
      .unique(async (db, value) => {
        const user = await db.from('users').where('email', value).first()
        return !user
      }),
    name: vine.string().trim().minLength(2).maxLength(50),
    password: vine.string().minLength(VALIDATION.PASSWORD_MIN).maxLength(VALIDATION.PASSWORD_MAX),
  })
)

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string(),
    password: vine.string().minLength(VALIDATION.PASSWORD_MIN),
    passwordConfirmation: vine.string().sameAs('password'),
  })
)

export const forgotPasswordValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim(),
  })
)

export type LoginValidator = Infer<typeof loginValidator>
export type RegisterValidator = Infer<typeof registerValidator>
export type ResetPasswordValidator = Infer<typeof resetPasswordValidator>
export type ForgotPasswordValidator = Infer<typeof forgotPasswordValidator>
