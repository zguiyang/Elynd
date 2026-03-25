import { test } from '@japa/runner'
import { ChapterTranslationService } from '#services/book/chapter_translation_service'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('Chapter Translation Paragraph Retry', (group) => {
  const originalRetry = ChapterTranslationService.prototype.retryParagraph

  group.each.teardown(() => {
    ChapterTranslationService.prototype.retryParagraph = originalRetry
  })

  test('POST /api/chapter-translations/:id/paragraphs/:index/retry returns 202', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser()
    cleanup(async () => {
      await user.delete()
    })

    ChapterTranslationService.prototype.retryParagraph = async function fakeRetry(
      translationId: number,
      index: number
    ) {
      return { translationId, paragraphIndex: index, status: 'queued' as const }
    }

    const response = await client
      .post('/api/chapter-translations/123/paragraphs/2/retry')
      .header('Authorization', bearerAuthHeader(token))

    assert.equal(response.status(), 202)
    assert.equal(response.body().status, 'queued')
    assert.equal(response.body().paragraphIndex, 2)
  })
})
