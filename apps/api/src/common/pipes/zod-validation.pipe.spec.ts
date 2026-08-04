import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'

import { createPaginatedRequestSchema } from '@elynd/shared/schemas'

import { ZodValidationPipe } from './zod-validation.pipe.js'

describe('ZodValidationPipe', () => {
  describe('PIPE-001 valid body', () => {
    it('returns parsed value when body matches schema', () => {
      const schema = z.object({
        name: z.string().min(1)
      })
      const pipe = new ZodValidationPipe(schema)

      const result = pipe.transform({ name: 'demo' }, { type: 'body' })

      expect(result).toEqual({ name: 'demo' })
    })
  })

  describe('PIPE-002 invalid body', () => {
    it('throws BadRequestException when required field is missing', () => {
      const schema = z.object({
        name: z.string().min(1)
      })
      const pipe = new ZodValidationPipe(schema)

      expect(() => pipe.transform({}, { type: 'body' })).toThrow(BadRequestException)
      try {
        pipe.transform({}, { type: 'body' })
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException)
        const response = (error as BadRequestException).getResponse() as { message: string }
        expect(String(response.message)).toMatch(/name/i)
      }
    })
  })

  describe('PIPE-003 invalid query coerce', () => {
    it('throws BadRequestException when page cannot be coerced', () => {
      const schema = createPaginatedRequestSchema({})
      const pipe = new ZodValidationPipe(schema)

      expect(() => pipe.transform({ page: 'abc' }, { type: 'query' })).toThrow(BadRequestException)
    })
  })
})
