import { test } from '@japa/runner'
import {
  VocabularyAnalyzerService,
  type VocabularyCandidate,
} from '#services/vocabulary_analyzer_service'
import { AiServiceError, AI_ERROR_CODES } from '#types/ai'

class MockConfigService {
  async getAiConfig() {
    return {
      baseUrl: 'https://example.com',
      apiKey: 'test-key',
      model: 'test-model',
    }
  }
}

test.group('VocabularyAnalyzerService.generateMeaningsWithAI', () => {
  test('splits large vocabulary into multiple AI requests', async ({ assert }) => {
    const calls: string[][] = []
    const mockAiService = {
      async chatJson(_config: unknown, params: { messages: Array<{ content: string }> }) {
        const userMessage = params.messages[1]?.content || ''
        const wordsLine =
          userMessage.split('\n').find((line) => line.startsWith('Words: ')) || 'Words: '
        const words = wordsLine.replace('Words: ', '').split(', ').filter(Boolean)

        calls.push(words)

        return {
          words: words.map((word) => ({
            word,
            meaning: `meaning of ${word}`,
            sentence: `Sentence with ${word}.`,
          })),
        }
      },
    }

    const service = new VocabularyAnalyzerService(
      mockAiService as any,
      new MockConfigService() as any
    )
    const vocabulary: VocabularyCandidate[] = Array.from({ length: 65 }, (_, index) => ({
      word: `word${index + 1}`,
      lemma: `word${index + 1}`,
      frequency: 1,
    }))

    const result = await service.generateMeaningsWithAI('Demo Book', vocabulary)

    assert.equal(result.length, 65)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].length, 40)
    assert.equal(calls[1].length, 25)
    assert.equal(result[0].meaning, 'meaning of word1')
    assert.equal(result[64].sentence, 'Sentence with word65.')
  })

  test('degrades gracefully when AI returns invalid JSON', async ({ assert }) => {
    const mockAiService = {
      async chatJson() {
        throw new AiServiceError(
          AI_ERROR_CODES.PARSE_ERROR,
          'Failed to parse AI response as JSON',
          new SyntaxError('Unterminated string in JSON at position 10')
        )
      },
    }

    const service = new VocabularyAnalyzerService(
      mockAiService as any,
      new MockConfigService() as any
    )
    const vocabulary: VocabularyCandidate[] = [
      { word: 'apple', lemma: 'apple', frequency: 3 },
      { word: 'banana', lemma: 'banana', frequency: 2 },
    ]

    const result = await service.generateMeaningsWithAI('Demo Book', vocabulary)

    assert.deepEqual(result, [
      { word: 'apple', lemma: 'apple', frequency: 3, meaning: '', sentence: '' },
      { word: 'banana', lemma: 'banana', frequency: 2, meaning: '', sentence: '' },
    ])
  })
})
