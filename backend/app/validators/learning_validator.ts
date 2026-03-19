import vine from '@vinejs/vine'
import { type Infer } from '@vinejs/vine/types'

export const progressValidator = vine.compile(
  vine.object({
    bookId: vine.number(),
    progress: vine.number().min(0).max(100),
  })
)

export type ProgressValidator = Infer<typeof progressValidator>
