import { test } from '@japa/runner'

test.group('TtsService chunking', () => {
  test('splits oversized chapter text into multiple chunks', async ({ assert }) => {
    // Import after app boots
    const { TtsService } = await import('#services/tts_service')

    const service = new TtsService()
    const chapter = {
      chapterIndex: 1,
      title: 'Long Chapter',
      content:
        'Paragraph one with some text.\n\nParagraph two with more text.\n\nParagraph three with even more text.',
    }

    // Access private method using type assertion
    const chunks = (
      service as unknown as { splitTextIntoChunks: (text: string, maxChars: number) => string[] }
    )['splitTextIntoChunks'](`${chapter.title}\n\n${chapter.content}`, 50)

    assert.isAbove(chunks.length, 1)
    assert.isTrue(chunks.every((chunk) => chunk.length <= 50))
  })

  test('merges chunk results with correct word timing offsets', async ({ assert }) => {
    const { TtsService } = await import('#services/tts_service')

    const service = new TtsService()

    const merged = (
      service as unknown as {
        mergeChunkResults: (
          results: {
            audioBuffer: Buffer
            duration: number
            wordTimings: {
              word: string
              audioOffset: number
              duration: number
              textOffset: number
              wordLength: number
            }[]
          }[]
        ) => {
          audioBuffer: Buffer
          duration: number
          wordTimings: {
            word: string
            audioOffset: number
            duration: number
            textOffset: number
            wordLength: number
          }[]
        }
      }
    )['mergeChunkResults']([
      {
        audioBuffer: Buffer.from('a'),
        duration: 1000,
        wordTimings: [
          { word: 'Hello', audioOffset: 0, duration: 400, textOffset: 0, wordLength: 5 },
        ],
      },
      {
        audioBuffer: Buffer.from('b'),
        duration: 800,
        wordTimings: [
          { word: 'World', audioOffset: 0, duration: 300, textOffset: 0, wordLength: 5 },
        ],
      },
    ])

    assert.equal(merged.wordTimings[1].audioOffset, 1000)
    assert.equal(merged.duration, 1800)
  })

  test('merges adjacent small paragraphs to reduce over-fragmentation', async ({ assert }) => {
    const { TtsService } = await import('#services/tts_service')

    const service = new TtsService()

    const text = 'Short paragraph.\n\nAnother short paragraph.\n\nYet another paragraph.'

    const chunks = (
      service as unknown as { splitTextIntoChunks: (text: string, maxChars: number) => string[] }
    )['splitTextIntoChunks'](text, 100)

    // With enough headroom, adjacent short paragraphs should be merged.
    assert.equal(chunks.length, 1)
  })

  test('keeps paragraph-first behavior when maxChars is tight', async ({ assert }) => {
    const { TtsService } = await import('#services/tts_service')

    const service = new TtsService()

    const text = 'Short paragraph.\n\nAnother short paragraph.\n\nYet another paragraph.'

    const chunks = (
      service as unknown as { splitTextIntoChunks: (text: string, maxChars: number) => string[] }
    )['splitTextIntoChunks'](text, 30)

    assert.equal(chunks.length, 3)
  })

  test('hard splits when paragraph exceeds maxChars', async ({ assert }) => {
    const { TtsService } = await import('#services/tts_service')

    const service = new TtsService()

    // Single long paragraph
    const text =
      'This is a very long paragraph that definitely exceeds the maximum character limit and should be split into multiple chunks by the algorithm.'

    const chunks = (
      service as unknown as { splitTextIntoChunks: (text: string, maxChars: number) => string[] }
    )['splitTextIntoChunks'](text, 50)

    // Should split into multiple chunks
    assert.isAbove(chunks.length, 1)
    assert.isTrue(chunks.every((chunk) => chunk.length <= 50))
  })
})
