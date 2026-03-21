import { test } from '@japa/runner'
import { AiService } from '#services/ai/ai_service'

test.group('AiService.chatJsonChunked', () => {
  test('splits input into chunks and merges in order', async ({ assert }) => {
    const service = new AiService()
    const calledChunks: number[][] = []

    ;(service as unknown as { chatJson: Function }).chatJson = async (
      _config: unknown,
      params: { messages: Array<{ content: string }> }
    ) => {
      const payload = JSON.parse(params.messages[1]?.content || '{}') as { ids: number[] }
      calledChunks.push(payload.ids)
      return { ids: payload.ids }
    }

    const result = await service.chatJsonChunked<number, { ids: number[] }, number[]>(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
        timeout: 1000,
        maxRetries: 0,
      },
      {
        items: [1, 2, 3, 4, 5],
        maxChunkChars: 4,
        maxChunkItems: 2,
        getItemChars: () => 2,
        buildParams: ({ chunkItems }) => ({
          messages: [
            { role: 'system', content: 'system' },
            { role: 'user', content: JSON.stringify({ ids: chunkItems }) },
          ],
          maxTokens: 100,
          temperature: 0,
          responseFormat: { type: 'json_object' },
        }),
        mergeResults: (results) => results.flatMap((item) => item.result.ids),
        logLabel: 'test',
      }
    )

    assert.deepEqual(calledChunks, [
      [1, 2],
      [3, 4],
      [5],
    ])
    assert.deepEqual(result, [1, 2, 3, 4, 5])
  })

  test('uses onChunkError fallback when one chunk fails', async ({ assert }) => {
    const service = new AiService()
    let callCount = 0

    ;(service as unknown as { chatJson: Function }).chatJson = async (
      _config: unknown,
      params: { messages: Array<{ content: string }> }
    ) => {
      callCount++
      const payload = JSON.parse(params.messages[1]?.content || '{}') as { ids: number[] }
      if (payload.ids.includes(3)) {
        throw new Error('simulated timeout')
      }
      return { ids: payload.ids }
    }

    const result = await service.chatJsonChunked<number, { ids: number[] }, number[]>(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
        timeout: 1000,
        maxRetries: 0,
      },
      {
        items: [1, 2, 3, 4],
        maxChunkChars: 2,
        maxChunkItems: 1,
        getItemChars: () => 1,
        buildParams: ({ chunkItems }) => ({
          messages: [
            { role: 'system', content: 'system' },
            { role: 'user', content: JSON.stringify({ ids: chunkItems }) },
          ],
          maxTokens: 100,
          temperature: 0,
          responseFormat: { type: 'json_object' },
        }),
        onChunkError: async ({ chunkItems }) => ({ ids: chunkItems.map((id) => id * 100) }),
        mergeResults: (results) => results.flatMap((item) => item.result.ids),
        logLabel: 'test',
      }
    )

    assert.equal(callCount, 4)
    assert.deepEqual(result, [1, 2, 300, 4])
  })
})
