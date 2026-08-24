import { z } from 'zod';

import { readerItemSummarySchema, readingProgressSchema } from '@gloaming/shared/api/reader';

/** Soft ceiling for shelf grid items (excludes `current`). */
export const SHELF_ITEMS_LIMIT = 48 as const;

export const shelfItemSchema = z.object({
  article: readerItemSummarySchema,
  progress: readingProgressSchema,
});

export type ShelfItem = z.infer<typeof shelfItemSchema>;

/** My shelf: continue hero + remaining progress-backed articles. */
export const shelfDataSchema = z.object({
  current: shelfItemSchema.nullable(),
  items: z.array(shelfItemSchema).max(SHELF_ITEMS_LIMIT),
});

export type ShelfData = z.infer<typeof shelfDataSchema>;
