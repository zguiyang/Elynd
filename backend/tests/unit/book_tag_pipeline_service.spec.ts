import { test } from '@japa/runner'
import { BookTagPipelineService } from '#services/book-import/book_tag_pipeline_service'

function createService() {
  return new BookTagPipelineService(
    { chatJson: async () => ({}) } as any,
    { render: () => '' } as any,
    { getAiConfig: async () => ({ baseUrl: '', apiKey: '', model: '' }) } as any,
    {
      generateSlug: (name: string) =>
        name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
          .replace(/^-+|-+$/g, ''),
    } as any,
    {} as any
  )
}

test.group('BookTagPipelineService tag selection helpers', () => {
  test('normalizeTagNames supports string/object items and removes duplicates', async ({
    assert,
  }) => {
    const service = createService() as any

    const normalized = service.normalizeTagNames([
      'Classic Literature',
      { name: 'classic literature' },
      { name: ' Fantasy ' },
      'Fantasy',
      null,
      1,
    ])

    assert.deepEqual(normalized, ['Classic Literature', 'Fantasy'])
  })

  test('pickFromExisting selects matched tags only and caps at two', async ({ assert }) => {
    const service = createService() as any
    const selectedTags: Array<{ id: number; name: string }> = []
    const selectedIds = new Set<number>()
    const existingBySlug = new Map<string, { id: number; name: string }>([
      ['classic', { id: 1, name: 'Classic' }],
      ['fantasy', { id: 2, name: 'Fantasy' }],
      ['adventure', { id: 3, name: 'Adventure' }],
    ])

    service.pickFromExisting(
      ['Classic', 'Adventure', 'Fantasy'],
      existingBySlug,
      selectedTags,
      selectedIds
    )

    assert.deepEqual(
      selectedTags.map((item) => item.name),
      ['Classic', 'Adventure']
    )
    assert.deepEqual(Array.from(selectedIds), [1, 3])
  })
})
