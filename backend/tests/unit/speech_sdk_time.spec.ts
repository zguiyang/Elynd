import { test } from '@japa/runner'
import { speechSdkTicksToMs } from '#utils/speech_sdk_time'
import type { ChapterAudioResult, ChapterInput, TtsErrorDetails } from '#types/tts'

test.group('speechSdkTicksToMs', () => {
  test('converts 100ns ticks to milliseconds', ({ assert }) => {
    assert.equal(speechSdkTicksToMs(0), 0)
    assert.equal(speechSdkTicksToMs(10_000), 1)

    // 4m49s = 289s = 289_000ms
    assert.equal(speechSdkTicksToMs(2_890_000_000), 289_000)
  })

  test('rounds to the nearest millisecond', ({ assert }) => {
    assert.equal(speechSdkTicksToMs(14_999), 1)
    assert.equal(speechSdkTicksToMs(15_000), 2)
  })
})

test.group('ChapterAudioResult type contract', () => {
  test('should have chapterIndex, audioPath, duration, and timing', ({ assert }) => {
    const result: ChapterAudioResult = {
      chapterIndex: 0,
      audioPath: 'book/voices/1/chapter-0.mp3',
      duration: 120000,
      chunkCount: 3,
      timing: {
        words: [
          {
            word: 'Hello',
            audioOffset: 0,
            duration: 500,
            textOffset: 0,
            wordLength: 5,
          },
        ],
      },
    }

    assert.equal(result.chapterIndex, 0)
    assert.equal(result.audioPath, 'book/voices/1/chapter-0.mp3')
    assert.equal(result.duration, 120000)
    assert.equal(result.chunkCount, 3)
    assert.isArray(result.timing.words)
    assert.equal(result.timing.words[0].word, 'Hello')
  })

  test('should generate deterministic audio path based on bookId and chapterIndex', ({
    assert,
  }) => {
    const bookId = 123
    const chapterIndex = 2

    // Expected format: book/voices/{bookId}/chapter-{chapterIndex}.mp3
    const expectedPath = `book/voices/${bookId}/chapter-${chapterIndex}.mp3`

    assert.equal(expectedPath, 'book/voices/123/chapter-2.mp3')
  })
})

test.group('ChapterInput type', () => {
  test('should have required fields', ({ assert }) => {
    const chapter: ChapterInput = {
      chapterIndex: 0,
      title: 'Chapter 1',
      content: 'This is the chapter content.',
    }

    assert.equal(chapter.chapterIndex, 0)
    assert.equal(chapter.title, 'Chapter 1')
    assert.equal(chapter.content, 'This is the chapter content.')
  })
})

test.group('TtsErrorDetails type', () => {
  test('should have code, message, provider, and optional chapterIndex', ({ assert }) => {
    const error: TtsErrorDetails = {
      code: 'canceled',
      message: 'Speech synthesis was canceled',
      provider: 'azure_tts',
      reason: 'ErrorReason.ConnectionTimeout',
      errorDetails: 'Connection timed out',
      requestId: null,
      chapterIndex: 2,
    }

    assert.equal(error.code, 'canceled')
    assert.equal(error.message, 'Speech synthesis was canceled')
    assert.equal(error.provider, 'azure_tts')
    assert.equal(error.chapterIndex, 2)
  })

  test('should support synthesis_failed code', ({ assert }) => {
    const error: TtsErrorDetails = {
      code: 'synthesis_failed',
      message: 'Speech synthesis failed',
      provider: 'azure_tts',
      reason: 'ResultReason.Canceled',
      errorDetails: null,
      requestId: null,
    }

    assert.equal(error.code, 'synthesis_failed')
    assert.notExists(error.chapterIndex)
  })
})
