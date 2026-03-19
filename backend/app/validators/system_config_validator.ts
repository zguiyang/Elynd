import vine from '@vinejs/vine'
import { type Infer } from '@vinejs/vine/types'

export const updateSystemConfigValidator = vine.compile(
  vine.object({
    aiBaseUrl: vine.string().trim().url().optional(),
    aiApiKey: vine.string().trim().optional(),
    aiModelName: vine.string().trim().optional(),
  })
)

export type UpdateSystemConfigData = Infer<typeof updateSystemConfigValidator>
