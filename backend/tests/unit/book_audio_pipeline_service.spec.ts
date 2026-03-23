import { test } from '@japa/runner'
import { BookAudioPipelineService } from '#services/book-import/pipeline/book_audio_pipeline_service'
import type { ChapterInput, WordTiming } from '#types/tts'

function createService() {
  return new BookAudioPipelineService({} as any, {} as any)
}

test.group('BookAudioPipelineService word alignment', () => {
  test('does not merge words connected by em dash when extracting expected words', async ({
    assert,
  }) => {
    const service = createService() as any

    const words = service.extractWords('the bank—the birds were dripping wet and cold')

    assert.deepEqual(words.slice(0, 5), ['the', 'bank', 'the', 'birds', 'were'])
  })

  test('accepts head alignment when timing words split punctuation-separated terms', async ({
    assert,
  }) => {
    const service = createService() as any

    const chapter: ChapterInput = {
      chapterIndex: 2,
      title: 'CHAPTER III. A Caucus-Race and a Long Tale',
      content:
        'They were indeed a queer-looking party that assembled on the bank—the birds with draggled feathers the animals with their fur clinging close to them and all dripping wet cross and uncomfortable in the cold wind of the shore.',
    }

    const actualTokens = [
      'chapter',
      'iii',
      'a',
      'caucusrace',
      'and',
      'a',
      'long',
      'tale',
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

  test('accepts short title-only chapters without minimum word boundary rejection', async ({
    assert,
  }) => {
    const service = createService() as any

    const chapter: ChapterInput = {
      chapterIndex: 0,
      title: 'FREDERICK WARNE',
      content: '----------------------------------------',
    }

    const timings: WordTiming[] = [
      {
        word: 'frederick',
        audioOffset: 0,
        duration: 110,
        textOffset: 0,
        wordLength: 9,
      },
      {
        word: 'warne',
        audioOffset: 120,
        duration: 80,
        textOffset: 10,
        wordLength: 5,
      },
    ]

    let thrown: Error | null = null
    try {
      service.assertWordTimings(chapter, timings)
    } catch (error) {
      thrown = error as Error
    }

    assert.isNull(thrown)
  })

  test('rejects tts input with html residue', async ({ assert }) => {
    const service = createService() as any

    let thrown: Error | null = null
    try {
      service.assertTtsInput({
        chapterIndex: 0,
        title: 'Chapter 1',
        content: '<div class="no-break">THE TALE OF PETER RABBIT</div>',
      })
    } catch (error) {
      thrown = error as Error
    }

    assert.isNotNull(thrown)
    assert.equal(thrown?.message, 'Invalid TTS input for chapter 0: html_or_epub_residue_detected')
  })

  test('aligns expected words with canonical speech normalization', async ({ assert }) => {
    const service = createService() as any

    const chapter: ChapterInput = {
      chapterIndex: 0,
      title: 'Chapter 1',
      content: 'Fish & Chips are served with tea.',
    }

    const timings: WordTiming[] = [
      { word: 'chapter', audioOffset: 0, duration: 100, textOffset: 0, wordLength: 7 },
      { word: '1', audioOffset: 100, duration: 80, textOffset: 8, wordLength: 1 },
      { word: 'fish', audioOffset: 200, duration: 90, textOffset: 10, wordLength: 4 },
      { word: 'amp', audioOffset: 290, duration: 60, textOffset: 15, wordLength: 3 },
      { word: 'chips', audioOffset: 350, duration: 90, textOffset: 19, wordLength: 5 },
      { word: 'are', audioOffset: 440, duration: 70, textOffset: 25, wordLength: 3 },
      { word: 'served', audioOffset: 510, duration: 80, textOffset: 29, wordLength: 6 },
      { word: 'with', audioOffset: 590, duration: 60, textOffset: 36, wordLength: 4 },
      { word: 'tea', audioOffset: 650, duration: 60, textOffset: 41, wordLength: 3 },
    ]

    let thrown: Error | null = null
    try {
      service.assertWordTimings(chapter, timings)
    } catch (error) {
      thrown = error as Error
    }

    assert.isNull(thrown)
  })
})
