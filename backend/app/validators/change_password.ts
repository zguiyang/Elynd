import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'

export const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string(),
    newPassword: vine.string().minLength(8).maxLength(128),
  })
)

export type ChangePasswordValidator = Infer<typeof changePasswordValidator>
