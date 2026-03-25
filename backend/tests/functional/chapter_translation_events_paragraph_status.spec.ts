import { test } from '@japa/runner'
import { ChapterTranslationService } from '#services/book/chapter_translation_service'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('Chapter Translation Events - Paragraph Status', (group) => {
  const originalGetProgress = ChapterTranslationService.prototype.getProgress
  const originalGetStatus = ChapterTranslationService.prototype.getStatus

  group.each.teardown(() => {
    ChapterTranslationService.prototype.getProgress = originalGetProgress
    ChapterTranslationService.prototype.getStatus = originalGetStatus
  })

  test('SSE emits paragraph status from progress payload', async ({ assert, client, cleanup }) => {
    const { user, token } = await createAuthenticatedUser()
    cleanup(async () => {
      await user.delete()
    })

    ChapterTranslationService.prototype.getStatus = async function fakeGetStatus(translationId: number) {
      return { translationId, status: 'processing' as const, errorMessage: null }
    }

    ChapterTranslationService.prototype.getProgress = async function fakeGetProgress(translationId: number) {
      return {
        translationId,
        status: 'completed',
        totalParagraphs: 2,
        completedParagraphs: 2,
        title: { original: 'T', translated: 'T' },
        paragraphs: [
          {
            paragraphIndex: 0,
            status: 'completed',
            sentences: [{ sentenceIndex: 0, original: 'A', translated: 'B' }],
          },
          { paragraphIndex: 1, status: 'failed', error: 'boom' },
        ],
      }
    }

    const response = await client
      .get('/api/chapter-translations/123/events')
      .header('Authorization', bearerAuthHeader(token))

    assert.equal(response.status(), 200)
    assert.include(response.text(), '"type":"paragraph"')
    assert.include(response.text(), '"status":"completed"')
    assert.include(response.text(), '"status":"failed"')
  })
})
