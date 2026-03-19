import vine from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'
import { VALIDATION } from '#constants'

export const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string(),
    newPassword: vine
      .string()
      .minLength(VALIDATION.PASSWORD_MIN)
      .maxLength(VALIDATION.PASSWORD_MAX),
  })
)

export type ChangePasswordValidator = Infer<typeof changePasswordValidator>
