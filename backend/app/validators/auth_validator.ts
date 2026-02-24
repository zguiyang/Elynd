import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'

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
    password: vine.string().minLength(6).maxLength(100),
  })
)

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string(),
    password: vine.string().minLength(8),
    passwordConfirmation: vine.string().sameAs('password'),
  })
)

export type LoginValidator = Infer<typeof loginValidator>
export type RegisterValidator = Infer<typeof registerValidator>
export type ResetPasswordValidator = Infer<typeof resetPasswordValidator>
