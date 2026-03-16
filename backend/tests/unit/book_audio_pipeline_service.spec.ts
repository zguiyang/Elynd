import { test } from '@japa/runner'
import { BookAudioPipelineService } from '#services/book_audio_pipeline_service'
import type { ChapterInput, WordTiming } from '#types/tts'

function createService() {
  return new BookAudioPipelineService({} as any, {} as any)
}

test.group('BookAudioPipelineService word alignment', () => {
  test('does not merge words connected by em dash when extracting expected words', async ({ assert }) => {
    const service = createService() as any

    const words = service.extractWords('the bank—the birds were dripping wet and cold')

    assert.deepEqual(words.slice(0, 5), ['the', 'bank', 'the', 'birds', 'were'])
  })

  test('accepts head alignment when timing words split punctuation-separated terms', async ({ assert }) => {
    const service = createService() as any

    const chapter: ChapterInput = {
      chapterIndex: 2,
      title: 'CHAPTER III. A Caucus-Race and a Long Tale',
      content:
        'They were indeed a queer-looking party that assembled on the bank—the birds with draggled feathers the animals with their fur clinging close to them and all dripping wet cross and uncomfortable in the cold wind of the shore.',
    }

    const actualTokens = [
      'they',
      'were',
      'indeed',
      'a',
      'queerlooking',
      'party',
      'that',
      'assembled',
      'on',
      'the',
      'bank',
      'the',
      'birds',
      'with',
      'draggled',
      'feathers',
      'the',
      'animals',
      'with',
      'their',
      'fur',
      'clinging',
      'close',
      'to',
      'them',
      'and',
      'all',
      'dripping',
      'wet',
      'cross',
      'and',
      'uncomfortable',
      'in',
      'the',
      'cold',
      'wind',
      'of',
      'the',
      'shore',
    ]

    const timings: WordTiming[] = actualTokens.map((word, index) => ({
      word,
      audioOffset: index * 100,
      duration: 90,
      textOffset: index,
      wordLength: word.length,
    }))

    let thrown: Error | null = null
    try {
      service.assertWordTimings(chapter, timings)
    } catch (error) {
      thrown = error as Error
    }

    assert.isNull(thrown)
  })
})
