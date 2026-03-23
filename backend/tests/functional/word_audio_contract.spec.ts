import { test } from '@japa/runner'
import { WordAudioService } from '#services/dictionary/word_audio_service'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('Word audio API contract', () => {
  test('GET /api/word-audio/:word requires authentication', async ({ client }) => {
    const response = await client.get('/api/word-audio/hello')
    response.assertStatus(401)
  })

  test('GET /api/word-audio/:word returns cached or generated data uri', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Word Audio User',
      emailPrefix: 'word-audio',
    })
    const originalGetAudio = WordAudioService.prototype.getAudio
    let capturedWord: string | null = null

    WordAudioService.prototype.getAudio = async function fakeGetAudio(word: string) {
      capturedWord = word
      return 'data:audio/mp3;base64,QUJD'
    }

    cleanup(async () => {
      WordAudioService.prototype.getAudio = originalGetAudio
      await user.delete()
    })

    const response = await client
      .get('/api/word-audio/Hello!')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.equal(response.body().audio, 'data:audio/mp3;base64,QUJD')
    assert.equal(capturedWord, 'Hello!')
  })

  test('GET /api/word-audio/:word validates empty input after normalization', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Word Audio User',
      emailPrefix: 'word-audio-validate',
    })

    cleanup(async () => {
      await user.delete()
    })

    const response = await client
      .get('/api/word-audio/!!!')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(422)
    assert.match(response.body().message, /Word is required/)
  })
})
