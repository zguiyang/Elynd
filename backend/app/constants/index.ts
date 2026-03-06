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
  KEY_PREFIX: 'email_verify:',
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

const ARTICLE_DIFFICULTY = {
  L1: 'L1', // Beginner
  L2: 'L2', // Intermediate
  L3: 'L3', // Advanced
} as const

type ArticleDifficulty = (typeof ARTICLE_DIFFICULTY)[keyof typeof ARTICLE_DIFFICULTY]

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

type ArticleContent = (typeof ARTICLE_CONTENT)[keyof typeof ARTICLE_CONTENT]

const ENGLISH_VARIANT = {
  US: 'en-US',
  GB: 'en-GB',
} as const

type EnglishVariant = (typeof ENGLISH_VARIANT)[keyof typeof ENGLISH_VARIANT]

const DICTIONARY = {
  CACHE_PREFIX: 'dictionary:',
  DEFAULT_TTL_DAYS: 7,
  EXPIRING_DAYS: 1,
} as const

type Dictionary = (typeof DICTIONARY)[keyof typeof DICTIONARY]

export {
  ORDER_BY,
  PAGINATION,
  SORT_ORDER,
  VALIDATION,
  EMAIL_VERIFICATION,
  AI,
  VOCABULARY_LEVEL,
  LANGUAGE,
  ARTICLE_DIFFICULTY,
  ARTICLE_CONTENT,
  ENGLISH_VARIANT,
  DICTIONARY,
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
  ArticleDifficulty,
  ArticleContent,
  EnglishVariant,
  Dictionary,
}
