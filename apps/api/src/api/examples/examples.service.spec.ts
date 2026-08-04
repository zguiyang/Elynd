import { NotFoundException } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DB } from '../../global/providers/db.provider.js'
import { ExamplesService } from './examples.service.js'

const sampleRow = {
  id: 'ex-1',
  user_id: 'user-1',
  name: 'Demo',
  description: 'desc',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z')
}

function createMockDb() {
  const insertReturning = vi.fn()
  const selectLimit = vi.fn()
  const selectWhere = vi.fn()
  const selectFrom = vi.fn()
  const updateReturning = vi.fn()
  const deleteWhere = vi.fn()
  const pageOffset = vi.fn()
  const pageLimit = vi.fn()
  const pageOrderBy = vi.fn()
  const pageWhere = vi.fn()
  const countWhere = vi.fn()

  const db = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: insertReturning
      })
    }),
    select: vi.fn((selection?: unknown) => {
      if (selection && typeof selection === 'object' && 'count' in (selection as object)) {
        return {
          from: vi.fn().mockReturnValue({
            where: countWhere
          })
        }
      }
      return {
        from: selectFrom.mockReturnValue({
          where: selectWhere.mockReturnValue({
            limit: selectLimit,
            orderBy: pageOrderBy.mockReturnValue({
              limit: pageLimit.mockReturnValue({
                offset: pageOffset
              })
            })
          })
        })
      }
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: updateReturning
        })
      })
    }),
    delete: vi.fn().mockReturnValue({
      where: deleteWhere
    }),
    _mocks: {
      insertReturning,
      selectLimit,
      selectWhere,
      updateReturning,
      deleteWhere,
      pageOffset,
      countWhere
    }
  }

  return db
}

describe('ExamplesService', () => {
  let service: ExamplesService
  let db: ReturnType<typeof createMockDb>

  beforeEach(async () => {
    db = createMockDb()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamplesService,
        {
          provide: DB,
          useValue: db
        }
      ]
    }).compile()

    service = module.get(ExamplesService)
  })

  describe('EX-001 createExample', () => {
    it('inserts with user_id and returns row', async () => {
      db._mocks.insertReturning.mockResolvedValue([sampleRow])

      const result = await service.createExample('user-1', {
        name: 'Demo',
        description: 'desc'
      })

      expect(db.insert).toHaveBeenCalled()
      expect(result).toEqual(sampleRow)
      expect(result.user_id).toBe('user-1')
    })
  })

  describe('EX-002 getExampleById missing', () => {
    it('throws NotFoundException when row is missing', async () => {
      db._mocks.selectLimit.mockResolvedValue([])

      await expect(service.getExampleById('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException
      )
    })
  })

  describe('EX-003 getExamples page', () => {
    it('returns PaginatedData shape', async () => {
      db._mocks.countWhere.mockResolvedValue([{ count: 1 }])
      db._mocks.pageOffset.mockResolvedValue([sampleRow])

      const result = await service.getExamples('user-1', {
        page: 1,
        pageSize: 10,
        orderBy: 'created_at',
        direction: 'desc'
      })

      expect(result).toEqual({
        content: [sampleRow],
        page: 1,
        pages: 1,
        pageSize: 10,
        total: 1
      })
    })
  })

  describe('EX-004 update/delete wrong user', () => {
    it('throws NotFoundException when updating another user example', async () => {
      db._mocks.selectLimit.mockResolvedValue([])

      await expect(
        service.updateExample('user-2', 'ex-1', { name: 'Nope' })
      ).rejects.toBeInstanceOf(NotFoundException)
    })

    it('throws NotFoundException when deleting another user example', async () => {
      db._mocks.selectLimit.mockResolvedValue([])

      await expect(service.deleteExample('user-2', 'ex-1')).rejects.toBeInstanceOf(
        NotFoundException
      )
    })
  })
})
