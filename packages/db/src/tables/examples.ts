import { createId } from '@paralleldrive/cuid2';
import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

import { users } from './auth.js';

/**
 * Examples table uses snake_case columns intentionally (template-aligned).
 * Auth tables remain camelCase for better-auth.
 */
export const examplesTable = pgTable('examples', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const insertExampleSchema = createInsertSchema(examplesTable, {
  id: z.string().describe('Example ID'),
  user_id: z.string().describe('Owner user ID'),
  name: z
    .string({
      error: 'Example name is required',
    })
    .min(1, {
      error: 'Example name cannot be empty',
    })
    .max(100, {
      error: 'Example name cannot exceed 100 characters',
    })
    .describe('Example name'),
  description: z.string().optional().describe('Example description'),
});

export const selectExampleSchema = createSelectSchema(examplesTable, {
  id: z.string().describe('Example ID'),
  user_id: z.string().describe('Owner user ID'),
  name: z
    .string({
      error: 'Example name is required',
    })
    .min(1, {
      error: 'Example name cannot be empty',
    })
    .max(100, {
      error: 'Example name cannot exceed 100 characters',
    })
    .describe('Example name'),
  description: z.string().optional().describe('Example description'),
});

export const updateExampleSchema = createUpdateSchema(examplesTable, {
  name: z
    .string()
    .min(1, {
      error: 'Example name cannot be empty',
    })
    .max(100, {
      error: 'Example name cannot exceed 100 characters',
    })
    .optional()
    .describe('Example name'),
  description: z.string().optional().describe('Example description'),
});

export type InsertExampleDto = z.infer<typeof insertExampleSchema>;
export type SelectExampleDto = z.infer<typeof selectExampleSchema>;
export type UpdateExampleDto = z.infer<typeof updateExampleSchema>;
