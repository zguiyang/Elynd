import { z } from 'zod'

/** Placeholder schema — replace with real form schemas later. */
export const scaffoldReadySchema = z.object({
  ready: z.literal(true)
})

export type ScaffoldReady = z.infer<typeof scaffoldReadySchema>
