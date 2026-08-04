import { z } from 'zod/v4'

import {
  insertExampleSchema,
  selectExampleSchema,
  updateExampleSchema
} from '@elynd/db'

import {
  createPaginatedRequestSchema,
  createPaginatedResponseSchema
} from '../common/response.schema.js'

export const exampleItemSchema = selectExampleSchema
  .extend({
    created_at: z.iso.datetime().describe('Created at'),
    updated_at: z.iso.datetime().describe('Updated at')
  })
  .meta({ description: 'Example item' })

export const exampleResponseSchema = exampleItemSchema
export const examplePageListResponseSchema = createPaginatedResponseSchema(exampleItemSchema)

export const createExampleDtoSchema = insertExampleSchema
  .pick({
    name: true,
    description: true
  })
  .meta({ description: 'Create example body' })

export const updateExampleDtoSchema = updateExampleSchema
  .pick({ name: true, description: true })
  .meta({ description: 'Update example body' })

export const queryExamplePageDtoSchema = createPaginatedRequestSchema(
  {
    name: z.string().optional().meta({ description: 'Filter by name' }),
    description: z.string().optional().meta({ description: 'Filter by description' })
  },
  {
    defaultPageSize: 10,
    orderByEnums: ['name', 'created_at', 'updated_at']
  }
).meta({ description: 'Paginated example query' })

export type CreateExampleDto = z.infer<typeof createExampleDtoSchema>
export type UpdateExampleDto = z.infer<typeof updateExampleDtoSchema>
export type QueryExamplePageDto = z.infer<typeof queryExamplePageDtoSchema>
export type ExampleResponse = z.infer<typeof exampleResponseSchema>
export type ExamplesPageListResponse = z.infer<typeof examplePageListResponseSchema>
