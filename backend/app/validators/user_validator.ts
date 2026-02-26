import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'

export const updateProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(100).optional(),
  })
)

export type UpdateProfileValidator = Infer<typeof updateProfileValidator>
