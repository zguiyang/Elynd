import type { ZodObject, ZodRawShape } from 'zod/v4'
import { z } from 'zod/v4'

import { PaginationDefaults, PaginationDirectionEnum } from '../../types/response.type.js'

/**
 * Create a paginated request schema with optional filter fields.
 */
export function createPaginatedRequestSchema<T extends ZodRawShape>(
  schemaShape: T,
  options?: {
    defaultPageSize?: number
    defaultDirection?: (typeof PaginationDirectionEnum)[keyof typeof PaginationDirectionEnum]
    orderByEnums?: Array<string>
  }
) {
  const {
    defaultPageSize = PaginationDefaults.PAGE_SIZE,
    defaultDirection = PaginationDefaults.DIRECTION,
    orderByEnums = [PaginationDefaults.DEFAULT_ORDER_BY] as const
  } = options || {}

  const paginationShape = {
    page: z.coerce
      .number()
      .int()
      .min(1)
      .positive()
      .default(PaginationDefaults.PAGE)
      .meta({ description: 'Page number' }),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .positive()
      .default(defaultPageSize)
      .meta({ description: 'Page size' }),
    orderBy: z
      .enum(orderByEnums)
      .default(PaginationDefaults.DEFAULT_ORDER_BY)
      .meta({
        description: `Order by field, default: ${PaginationDefaults.DEFAULT_ORDER_BY}`
      }),
    direction: z
      .enum([PaginationDirectionEnum.ASC, PaginationDirectionEnum.DESC])
      .default(defaultDirection)
      .meta({ description: 'Sort direction: asc or desc' })
  }

  return z.object({
    ...schemaShape,
    ...paginationShape
  })
}

/**
 * Create a paginated response schema wrapping an item schema.
 */
export function createPaginatedResponseSchema<T extends ZodObject>(itemSchema: T) {
  return z.object({
    content: z.array(itemSchema).describe('Page content'),
    page: z.coerce.number().int().min(1).positive().describe('Current page'),
    pages: z.coerce.number().int().min(0).describe('Total pages'),
    pageSize: z.coerce.number().int().min(1).positive().describe('Page size'),
    total: z.coerce.number().int().min(0).describe('Total items')
  })
}

export const paginatedRequestSchema = createPaginatedRequestSchema({})

export type PaginatedRequest = z.infer<typeof paginatedRequestSchema>
