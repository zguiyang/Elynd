const ORDER_BY = {
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  TITLE: 'title',
} as const

type OrderBy = (typeof ORDER_BY)[keyof typeof ORDER_BY]

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,
} as const

type Pagination = (typeof PAGINATION)[keyof typeof PAGINATION]

const SORT_ORDER = {
  ASC: 'asc',
  DESC: 'desc',
} as const

type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER]

const VALIDATION = {
  TITLE_MIN: 1,
  TITLE_MAX: 200,
  DESCRIPTION_MAX: 500,
  TAG_NAME_MIN: 1,
  TAG_NAME_MAX: 100,
  COLOR_HEX_LENGTH: 7,
  METADATA_MAX_SIZE: 65535,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 100,
  EMAIL_VERIFICATION_EXPIRY_MINUTES: 30,
  MESSAGE_MIN: 1,
  MESSAGE_MAX: 2000,
} as const

type Validation = (typeof VALIDATION)[keyof typeof VALIDATION]

const EMAIL_VERIFICATION = {
  KEY_PREFIX: 'verify:',
  EXPIRY_MINUTES: 30,
  COOLDOWN_MINUTES: 1,
} as const

type EmailVerification = (typeof EMAIL_VERIFICATION)[keyof typeof EMAIL_VERIFICATION]

const AI = {
  DEFAULT_TIMEOUT: 120000,
  ARTICLE_GENERATION_TIMEOUT: 600000,
  DEFAULT_MAX_RETRIES: 2,
} as const

type Ai = (typeof AI)[keyof typeof AI]

const VOCABULARY_LEVEL = {
  BEGINNER: 'beginner', // 0-500 词
  ELEMENTARY: 'elementary', // 500-1500 词
  INTERMEDIATE: 'intermediate', // 1500-3000 词
  UPPER: 'upper', // 3000+ 词
} as const

type VocabularyLevel = (typeof VOCABULARY_LEVEL)[keyof typeof VOCABULARY_LEVEL]

const LANGUAGE = {
  ZH: 'zh', // 中文
  EN: 'en', // English
  JA: 'ja', // 日本語
  KO: 'ko', // 한국어
  FR: 'fr', // Français
  DE: 'de', // Deutsch
  ES: 'es', // Español
} as const

type Language = (typeof LANGUAGE)[keyof typeof LANGUAGE]

const ARTICLE_CONTENT = {
  MAX_CHARS: 100000,
  MAX_WORDS: 3000,
  MAX_TOKENS: 8000,
  MAX_WORDS_L1: 800,
  MAX_WORDS_L2: 1500,
  MAX_WORDS_L3: 2500,
  MAX_TOKENS_L1: 2000,
  MAX_TOKENS_L2: 4000,
  MAX_TOKENS_L3: 6000,
  READING_SPEED: 200,
} as const

type BookContent = (typeof ARTICLE_CONTENT)[keyof typeof ARTICLE_CONTENT]

const ENGLISH_VARIANT = {
  US: 'en-US',
  GB: 'en-GB',
} as const

type EnglishVariant = (typeof ENGLISH_VARIANT)[keyof typeof ENGLISH_VARIANT]

const DICTIONARY = {
  CACHE_PREFIX: 'dictionary:',
  DEFAULT_TTL_DAYS: 7,
  EXPIRING_DAYS: 1,
  LOOKUP_TIMEOUT_MS: 5000,
  WORD_MAX_LENGTH: 64,
} as const

type Dictionary = (typeof DICTIONARY)[keyof typeof DICTIONARY]

const VOCABULARY_ANALYZER = {
  MAX_WORDS_PER_REQUEST: 40,
  MIN_WORDS_PER_REQUEST: 10,
  MEANING_MAX_TOKENS: 3000,
} as const

type VocabularyAnalyzer = (typeof VOCABULARY_ANALYZER)[keyof typeof VOCABULARY_ANALYZER]

const BOOK_IMPORT_STEP = {
  PREPARE_IMPORT: 'prepare_import',
  SEMANTIC_CLEAN: 'semantic_clean',
  VALIDATE_CHAPTER_CONTENT: 'validate_chapter_content',
  BUILD_CONTENT_AND_VOCAB_SEED: 'build_content_and_vocab_seed',
  ENRICH_VOCABULARY: 'enrich_vocabulary',
  GENERATE_TAGS: 'generate_tags',
  GENERATE_TTS: 'generate_tts',
  FINALIZE_IMPORT: 'finalize_import',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

type BookImportStep = (typeof BOOK_IMPORT_STEP)[keyof typeof BOOK_IMPORT_STEP]

const BOOK_IMPORT_PROGRESS = {
  PREPARE_IMPORT: 10,
  SEMANTIC_CLEAN: 20,
  VALIDATE_CHAPTER_CONTENT: 20,
  BUILD_CONTENT_AND_VOCAB_SEED: 15,
  ENRICH_VOCABULARY: 15,
  GENERATE_TAGS: 5,
  GENERATE_TTS: 10,
  FINALIZE_IMPORT: 5,
  TOTAL_MAX: 100,
} as const

type BookImportProgress = (typeof BOOK_IMPORT_PROGRESS)[keyof typeof BOOK_IMPORT_PROGRESS]

const TTS_CHUNK_STRATEGY = {
  MIN_CHARS: 1200,
  MAX_CHARS: 3500,
  TARGET_CHUNK_MIN: 8,
  TARGET_CHUNK_MAX: 24,
  CHUNKER_VERSION: 'v1',
  REUSE_AUDIO_STATUS: 'completed',
} as const

type TtsChunkStrategy = (typeof TTS_CHUNK_STRATEGY)[keyof typeof TTS_CHUNK_STRATEGY]

const CHAPTER_TRANSLATION = {
  CACHE_PREFIX: 'chapter_translation',
  PROMPT_VERSION: 'v1',
  RESULT_TTL_SECONDS: 60 * 60 * 24 * 30,
} as const

type ChapterTranslation = (typeof CHAPTER_TRANSLATION)[keyof typeof CHAPTER_TRANSLATION]

export {
  ORDER_BY,
  PAGINATION,
  SORT_ORDER,
  VALIDATION,
  EMAIL_VERIFICATION,
  AI,
  VOCABULARY_LEVEL,
  LANGUAGE,
  ARTICLE_CONTENT,
  ENGLISH_VARIANT,
  DICTIONARY,
  VOCABULARY_ANALYZER,
  BOOK_IMPORT_STEP,
  BOOK_IMPORT_PROGRESS,
  TTS_CHUNK_STRATEGY,
  CHAPTER_TRANSLATION,
}
export type {
  OrderBy,
  Pagination,
  SortOrder,
  Validation,
  EmailVerification,
  Ai,
  VocabularyLevel,
  Language,
  BookContent,
  EnglishVariant,
  Dictionary,
  VocabularyAnalyzer,
  BookImportStep,
  BookImportProgress,
  TtsChunkStrategy,
  ChapterTranslation,
}
