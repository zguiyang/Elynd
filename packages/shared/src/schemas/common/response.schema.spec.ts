import { describe, expect, it } from 'vitest'

import { PaginationDefaults } from '../../types/response.type.js'
import { createPaginatedRequestSchema, createPaginatedResponseSchema } from './response.schema.js'
import { z } from 'zod/v4'

describe('pagination schemas', () => {
  describe('PAGE-001 defaults', () => {
    it('applies page/pageSize/direction/orderBy defaults when omitted', () => {
      const schema = createPaginatedRequestSchema({})
      const parsed = schema.parse({})

      expect(parsed.page).toBe(PaginationDefaults.PAGE)
      expect(parsed.pageSize).toBe(PaginationDefaults.PAGE_SIZE)
      expect(parsed.direction).toBe(PaginationDefaults.DIRECTION)
      expect(parsed.orderBy).toBe(PaginationDefaults.DEFAULT_ORDER_BY)
    })
  })

  describe('PAGE-002 response shape', () => {
    it('includes content, page, pages, pageSize, total', () => {
      const item = z.object({ id: z.string() })
      const schema = createPaginatedResponseSchema(item)
      const shape = schema.shape

      expect(shape).toHaveProperty('content')
      expect(shape).toHaveProperty('page')
      expect(shape).toHaveProperty('pages')
      expect(shape).toHaveProperty('pageSize')
      expect(shape).toHaveProperty('total')
    })
  })

  describe('PAGE-003 custom orderBy enums', () => {
    it('accepts only listed orderBy values', () => {
      const schema = createPaginatedRequestSchema({}, { orderByEnums: ['name', 'created_at'] })

      expect(schema.parse({ orderBy: 'name' }).orderBy).toBe('name')
      expect(() => schema.parse({ orderBy: 'unknown' })).toThrow()
    })
  })
})
