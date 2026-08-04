import { z } from 'zod'

/** Placeholder schema — kept for scaffold smoke imports. */
export const scaffoldReadySchema = z.object({
  ready: z.literal(true)
})

export type ScaffoldReady = z.infer<typeof scaffoldReadySchema>
