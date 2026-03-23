import { inject } from '@adonisjs/core'
import { dispatch } from 'adonisjs-jobs/services/main'
import { BOOK_IMPORT_STEP } from '#constants'
import type { DispatchableImportStep } from '#types/book_import_pipeline'

@inject()
export class BookImportJobDispatcherService {
  static buildPipelineJobId(params: { runId: number; bookId: number; stepKey: string }): string {
    const { runId, bookId, stepKey } = params
    return `import-run-${runId}-book-${bookId}-step-${stepKey}`
  }

  async scheduleImportPipeline(payload: { bookId: number; userId: number }) {
    const { default: ProcessBookJob } = await import('#jobs/process_book_job')
    const jobId = (await dispatch(ProcessBookJob, payload)) as string | undefined
    return jobId || `manual-import-${Date.now()}`
  }

  async scheduleImportPipelineFromStep(payload: {
    bookId: number
    userId: number
    runId: number
    stepKey: DispatchableImportStep
  }) {
    const { bookId, userId, runId, stepKey } = payload
    const commonPayload = { bookId, userId, runId }
    const jobId = BookImportJobDispatcherService.buildPipelineJobId({
      runId,
      bookId,
      stepKey,
    })

    switch (stepKey) {
      case BOOK_IMPORT_STEP.PREPARE_IMPORT: {
        const { default: PrepareImportJob } = await import('#jobs/prepare_import_job')
        return (
          ((await dispatch(PrepareImportJob, commonPayload, { jobId })) as string | undefined) ||
          jobId
        )
      }
      case BOOK_IMPORT_STEP.SEMANTIC_CLEAN: {
        const { default: SemanticCleanJob } = await import('#jobs/semantic_clean_job')
        return (
          ((await dispatch(SemanticCleanJob, commonPayload, { jobId })) as string | undefined) ||
          jobId
        )
      }
      case BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED: {
        const { default: BuildContentAndVocabSeedJob } =
          await import('#jobs/build_content_and_vocab_seed_job')
        return (
          ((await dispatch(BuildContentAndVocabSeedJob, commonPayload, { jobId })) as
            | string
            | undefined) || jobId
        )
      }
      case BOOK_IMPORT_STEP.ENRICH_VOCABULARY: {
        const { default: EnrichVocabularyJob } = await import('#jobs/enrich_vocabulary_job')
        return (
          ((await dispatch(EnrichVocabularyJob, commonPayload, { jobId })) as string | undefined) ||
          jobId
        )
      }
      case BOOK_IMPORT_STEP.GENERATE_TTS: {
        const { default: GenerateTtsJob } = await import('#jobs/generate_tts_job')
        return (
          ((await dispatch(GenerateTtsJob, commonPayload, { jobId })) as string | undefined) ||
          jobId
        )
      }
      case BOOK_IMPORT_STEP.FINALIZE_IMPORT: {
        const { default: FinalizeImportJob } = await import('#jobs/finalize_import_job')
        return (
          ((await dispatch(FinalizeImportJob, commonPayload, { jobId })) as string | undefined) ||
          jobId
        )
      }
      default:
        throw new Error(`Unsupported dispatch step: ${String(stepKey)}`)
    }
  }
}
