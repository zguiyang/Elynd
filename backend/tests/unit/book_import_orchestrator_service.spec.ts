import { test } from '@japa/runner'
import { BOOK_IMPORT_STEP } from '#constants'
import { BOOK_IMPORT_STEP_TRANSITIONS } from '#types/book_import_pipeline'

test.group('BookImportOrchestratorService serial contract', () => {
  test('step transition chain is deterministic and strictly serial', async ({ assert }) => {
    assert.equal(
      BOOK_IMPORT_STEP_TRANSITIONS[BOOK_IMPORT_STEP.PREPARE_IMPORT],
      BOOK_IMPORT_STEP.SEMANTIC_CLEAN
    )
    assert.equal(
      BOOK_IMPORT_STEP_TRANSITIONS[BOOK_IMPORT_STEP.SEMANTIC_CLEAN],
      BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED
    )
    assert.equal(
      BOOK_IMPORT_STEP_TRANSITIONS[BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED],
      BOOK_IMPORT_STEP.ENRICH_VOCABULARY
    )
    assert.equal(
      BOOK_IMPORT_STEP_TRANSITIONS[BOOK_IMPORT_STEP.ENRICH_VOCABULARY],
      BOOK_IMPORT_STEP.GENERATE_TTS
    )
    assert.equal(
      BOOK_IMPORT_STEP_TRANSITIONS[BOOK_IMPORT_STEP.GENERATE_TTS],
      BOOK_IMPORT_STEP.FINALIZE_IMPORT
    )
    assert.equal(
      BOOK_IMPORT_STEP_TRANSITIONS[BOOK_IMPORT_STEP.FINALIZE_IMPORT],
      BOOK_IMPORT_STEP.COMPLETED
    )
  })

  test('vocabulary step runs before tts step', async ({ assert }) => {
    assert.equal(
      BOOK_IMPORT_STEP_TRANSITIONS[BOOK_IMPORT_STEP.ENRICH_VOCABULARY],
      BOOK_IMPORT_STEP.GENERATE_TTS
    )
  })
})
