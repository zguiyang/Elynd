import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'
import { VALIDATION, AVATAR } from '#constants'

export const updateProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(100).optional(),
  })
)

export type UpdateProfileValidator = Infer<typeof updateProfileValidator>

export const changeEmailValidator = vine.compile(
  vine.object({
    newEmail: vine.string().email().normalizeEmail(),
    password: vine.string().minLength(VALIDATION.PASSWORD_MIN),
  })
)

export type ChangeEmailValidator = Infer<typeof changeEmailValidator>

export const avatarUploadValidator = vine.compile(
  vine.object({
    avatar: vine.file({
      size: AVATAR.MAX_SIZE,
      extnames: ['jpg', 'jpeg', 'png', 'gif'],
    }),
  })
)

export type AvatarUploadValidator = Infer<typeof avatarUploadValidator>
