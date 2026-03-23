import { BOOK_IMPORT_STEP } from '#constants'

/**
 * Step states are owned by import pipeline orchestration only.
 * Jobs must not write arbitrary step values.
 */
const BOOK_IMPORT_SERIAL_STEPS = [
  BOOK_IMPORT_STEP.PREPARE_IMPORT,
  BOOK_IMPORT_STEP.SEMANTIC_CLEAN,
  BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
  BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
  BOOK_IMPORT_STEP.GENERATE_TTS,
  BOOK_IMPORT_STEP.FINALIZE_IMPORT,
] as const

type BookImportSerialStep = (typeof BOOK_IMPORT_SERIAL_STEPS)[number]
type DispatchableImportStep = BookImportSerialStep

type BookImportTerminalStep = typeof BOOK_IMPORT_STEP.COMPLETED | typeof BOOK_IMPORT_STEP.FAILED

type BookImportPipelineStep = BookImportSerialStep | BookImportTerminalStep

/**
 * Each step can only move to one deterministic next step.
 * `null` means the step is terminal.
 */
type BookImportStepTransitionMap = {
  [K in BookImportPipelineStep]: BookImportPipelineStep | null
}

const BOOK_IMPORT_STEP_TRANSITIONS: BookImportStepTransitionMap = {
  [BOOK_IMPORT_STEP.PREPARE_IMPORT]: BOOK_IMPORT_STEP.SEMANTIC_CLEAN,
  [BOOK_IMPORT_STEP.SEMANTIC_CLEAN]: BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
  [BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED]: BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
  [BOOK_IMPORT_STEP.ENRICH_VOCABULARY]: BOOK_IMPORT_STEP.GENERATE_TTS,
  [BOOK_IMPORT_STEP.GENERATE_TTS]: BOOK_IMPORT_STEP.FINALIZE_IMPORT,
  [BOOK_IMPORT_STEP.FINALIZE_IMPORT]: BOOK_IMPORT_STEP.COMPLETED,
  [BOOK_IMPORT_STEP.COMPLETED]: null,
  [BOOK_IMPORT_STEP.FAILED]: null,
}

interface SerialImportPayload {
  bookId: number
  userId: number
  runId: number
}

interface ChapterArtifactItem {
  title: string
  content: string
  chapterIndex: number
}

export { BOOK_IMPORT_SERIAL_STEPS, BOOK_IMPORT_STEP_TRANSITIONS }
export type {
  BookImportPipelineStep,
  BookImportSerialStep,
  DispatchableImportStep,
  BookImportStepTransitionMap,
  BookImportTerminalStep,
  ChapterArtifactItem,
  SerialImportPayload,
}
