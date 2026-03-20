import { test } from '@japa/runner'
import { ChapterTranslationService } from '#services/chapter_translation_service'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('Chapter Translation Events API', (group) => {
  const originalGetStatus = ChapterTranslationService.prototype.getStatus

  group.each.teardown(() => {
    ChapterTranslationService.prototype.getStatus = originalGetStatus
  })

  test('GET /api/chapter-translations/:id/events returns SSE status event for completed task', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Chapter Translation SSE User',
      emailPrefix: 'chapter-translation-sse',
    })

    cleanup(async () => {
      await user.delete()
    })

    ChapterTranslationService.prototype.getStatus = async function fakeGetStatus(
      translationId: number
    ) {
      return {
        translationId,
        status: 'completed' as const,
        errorMessage: null,
      }
    }

    const response = await client
      .get('/api/chapter-translations/123/events')
      .header('Authorization', bearerAuthHeader(token))

    assert.equal(response.status(), 200)
    assert.include(response.header('content-type') || '', 'text/event-stream')
    assert.include(response.text(), ': connected')
    assert.include(
      response.text(),
      'data: {"type":"status","translationId":123,"status":"completed","errorMessage":null}'
    )
  })

  test('GET /api/chapter-translations/:id/events validates translation id', async ({
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Chapter Translation SSE Validation User',
      emailPrefix: 'chapter-translation-sse-validation',
    })

    cleanup(async () => {
      await user.delete()
    })

    const response = await client
      .get('/api/chapter-translations/invalid/events')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(422)
  })
})
