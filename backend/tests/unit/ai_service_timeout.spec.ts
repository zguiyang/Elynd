import { test } from '@japa/runner'
import { AiService } from '#services/ai/ai_service'

test.group('AiService timeout policy', () => {
  test('creates an independent client per request config', async ({ assert }) => {
    const service = new AiService()

    const firstClient = (service as any).getClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'first-key',
      model: 'test-model',
      timeout: 1000,
    })

    const secondClient = (service as any).getClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'first-key',
      model: 'test-model',
      timeout: 5000,
    })

    assert.notStrictEqual(firstClient, secondClient)
  })
})
