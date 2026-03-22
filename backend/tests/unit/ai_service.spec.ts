import { test } from '@japa/runner'
import { AiService } from '#services/ai/ai_service'

test.group('AiService.chatJson', () => {
  test('retries once when the first response is not valid JSON', async ({ assert }) => {
    const service = new AiService()
    let callCount = 0

    ;(service as any).doChat = async () => {
      callCount++

      if (callCount === 1) {
        return {
          content: 'I am sorry, but here is the answer: not json',
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        }
      }

      return {
        content: '{"word":"apple","meanings":[{"partOfSpeech":"noun"}]}',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }
    }

    const result = await service.chatJson(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
      },
      {
        messages: [{ role: 'user', content: 'Return JSON only' }],
        maxTokens: 100,
        temperature: 0,
        responseFormat: { type: 'json_object' },
      }
    )

    assert.equal(callCount, 2)
    assert.deepEqual(result, { word: 'apple', meanings: [{ partOfSpeech: 'noun' }] })
  })
})
