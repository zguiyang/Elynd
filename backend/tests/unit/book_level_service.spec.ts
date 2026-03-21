import { test } from '@japa/runner'
import { BookLevelService } from '#services/book/book_level_service'

test.group('BookLevelService.resolveLevelByWordCount', () => {
  test('uses deterministic range rules and falls back to the last active level', async ({
    assert,
  }) => {
    const service = new BookLevelService()
    const levels = [
      {
        id: 1,
        code: 'L1',
        name: 'Beginner',
        description: '0-500',
        minWords: 0,
        maxWords: 500,
        sortOrder: 1,
        isActive: true,
      },
      {
        id: 2,
        code: 'L2',
        name: 'Elementary',
        description: '500-1000',
        minWords: 500,
        maxWords: 1000,
        sortOrder: 2,
        isActive: true,
      },
      {
        id: 3,
        code: 'L3',
        name: 'Intermediate',
        description: '1000-2000',
        minWords: 1000,
        maxWords: 2000,
        sortOrder: 3,
        isActive: true,
      },
      {
        id: 4,
        code: 'L4',
        name: 'Advanced',
        description: '2000+',
        minWords: 2000,
        maxWords: null,
        sortOrder: 4,
        isActive: true,
      },
    ]

    assert.equal(service.resolveLevelByWordCount(levels as any, 120).code, 'L1')
    assert.equal(service.resolveLevelByWordCount(levels as any, 500).code, 'L1')
    assert.equal(service.resolveLevelByWordCount(levels as any, 800).code, 'L2')
    assert.equal(service.resolveLevelByWordCount(levels as any, 1500).code, 'L3')
    assert.equal(service.resolveLevelByWordCount(levels as any, 5000).code, 'L4')
  })
})
