import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'
import { AVATAR } from '#constants'

export const updateProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(100).optional(),
  })
)

export type UpdateProfileValidator = Infer<typeof updateProfileValidator>

export const avatarUploadValidator = vine.compile(
  vine.object({
    avatar: vine.file({
      size: AVATAR.MAX_SIZE,
      extnames: ['jpg', 'jpeg', 'png', 'gif'],
    }),
  })
)

export type AvatarUploadValidator = Infer<typeof avatarUploadValidator>
