import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'

export const updateSystemConfigValidator = vine.compile(
  vine.array(
    vine.object({
      key: vine.string().trim().minLength(1).maxLength(255),
      value: vine.string().trim().optional(),
      description: vine.string().trim().maxLength(500).optional(),
    })
  )
)

export type UpdateSystemConfigData = Infer<typeof updateSystemConfigValidator>
