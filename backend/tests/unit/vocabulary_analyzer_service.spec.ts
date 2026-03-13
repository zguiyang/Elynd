import { test } from '@japa/runner'
import { VocabularyAnalyzerService } from '#services/vocabulary_analyzer_service'

test.group('VocabularyAnalyzerService.extractVocabulary', () => {
  test('extracts stable lemma-frequency pairs from content', async ({ assert }) => {
    const service = new VocabularyAnalyzerService()
    const content = `
      Alice is reading books.
      Alice reads books every day.
      Books help Alice improve vocabulary.
    `

    const result = service.extractVocabulary(content)
    const words = result.map((item) => item.word)

    assert.isTrue(result.length > 0)
    assert.isTrue(words.includes('alice'))
    assert.isTrue(result.every((item) => item.frequency > 0))
  })

  test('filters short and stop words', async ({ assert }) => {
    const service = new VocabularyAnalyzerService()
    const result = service.extractVocabulary('a an the to in by with customword customword')

    assert.equal(result.length, 1)
    assert.equal(result[0].word, 'customword')
    assert.equal(result[0].frequency, 2)
  })
})
