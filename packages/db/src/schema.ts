import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** Better Auth core tables (PostgreSQL) + username plugin / product fields. */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  /** Username plugin (normalized, unique). */
  username: text('username').unique(),
  /** Username plugin (display form as entered). */
  displayUsername: text('display_username'),
  /** Product role — server-default `user`; never client-settable via BA input. */
  role: text('role').default('user').notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

/** Short-article library unit (admin CMS + learner catalog). */
export const article = pgTable(
  'article',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    level: text('level').notNull().default('easy'),
    themes: jsonb('themes').$type<string[]>().notNull().default([]),
    sourceNote: text('source_note').notNull().default(''),
    status: text('status').notNull().default('draft'),
    seriesId: text('series_id'),
    seriesOrder: integer('series_order'),
    estimatedMinutes: integer('estimated_minutes'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('article_status_idx').on(table.status),
    index('article_series_idx').on(table.seriesId, table.seriesOrder),
  ],
);

/** Learner reading position per user × article (Today resume). */
export const readingProgress = pgTable(
  'reading_progress',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    articleId: text('article_id')
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('in_progress'),
    /** 0–100 integer percent. */
    progressRatio: integer('progress_ratio').notNull().default(0),
    lastReadAt: timestamp('last_read_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique('reading_progress_user_article_uidx').on(table.userId, table.articleId),
    index('reading_progress_user_last_read_idx').on(table.userId, table.lastReadAt),
    index('reading_progress_article_idx').on(table.articleId),
  ],
);

export type PracticeItemPayload =
  { prompt: string; options: string[] } | { word: string; hint: string; quote: string; options: string[] };

/** Curated practice question bound to an article. */
export const practiceItem = pgTable(
  'practice_item',
  {
    id: text('id').primaryKey(),
    articleId: text('article_id')
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').$type<PracticeItemPayload>().notNull(),
    /** 0-based; never returned on learner APIs. */
    correctOptionIndex: integer('correct_option_index').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique('practice_item_article_sort_uidx').on(table.articleId, table.sortOrder),
    index('practice_item_article_idx').on(table.articleId),
  ],
);

export type PracticeAttemptAnswer = {
  practiceItemId: string;
  selectedOptionIndex: number;
};

/** One practice session for a user on an article. */
export const practiceAttempt = pgTable(
  'practice_attempt',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    articleId: text('article_id')
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('in_progress'),
    currentIndex: integer('current_index').notNull().default(0),
    answers: jsonb('answers').$type<PracticeAttemptAnswer[]>().notNull().default([]),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    finishedAt: timestamp('finished_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('practice_attempt_one_in_progress_uidx')
      .on(table.userId, table.articleId)
      .where(sql`${table.status} = 'in_progress'`),
    index('practice_attempt_user_idx').on(table.userId),
    index('practice_attempt_article_idx').on(table.articleId),
  ],
);

export const readingProgressRelations = relations(readingProgress, ({ one }) => ({
  user: one(user, {
    fields: [readingProgress.userId],
    references: [user.id],
  }),
  article: one(article, {
    fields: [readingProgress.articleId],
    references: [article.id],
  }),
}));

export const practiceItemRelations = relations(practiceItem, ({ one }) => ({
  article: one(article, {
    fields: [practiceItem.articleId],
    references: [article.id],
  }),
}));

export const practiceAttemptRelations = relations(practiceAttempt, ({ one }) => ({
  user: one(user, {
    fields: [practiceAttempt.userId],
    references: [user.id],
  }),
  article: one(article, {
    fields: [practiceAttempt.articleId],
    references: [article.id],
  }),
}));

/** OpenAI-compatible LLM gateway credentials (API key encrypted at rest). */
export const llmProvider = pgTable('llm_provider', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  apiKeyCiphertext: text('api_key_ciphertext').notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/** Callable model under a provider (upstream model id + tuning). */
export const llmModel = pgTable(
  'llm_model',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id')
      .notNull()
      .references(() => llmProvider.id, { onDelete: 'cascade' }),
    modelId: text('model_id').notNull(),
    label: text('label').notNull(),
    temperature: doublePrecision('temperature'),
    maxTokens: integer('max_tokens'),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique('llm_model_provider_model_uidx').on(table.providerId, table.modelId),
    index('llm_model_provider_idx').on(table.providerId),
  ],
);

/** App-level purpose → default model binding (e.g. assist.default_model_id). */
export const llmAppSetting = pgTable('llm_app_setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/** Singleton Azure TTS credentials + default / accent voice bindings. */
export const ttsConfig = pgTable('tts_config', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull().default('azure'),
  region: text('region').notNull(),
  apiKeyCiphertext: text('api_key_ciphertext').notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  defaultVoice: text('default_voice').notNull(),
  usVoice: text('us_voice').notNull(),
  ukVoice: text('uk_voice').notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/** Per-article per-role TTS audio metadata (bytes live in Redis with 30-day TTL). */
export const articleAudio = pgTable(
  'article_audio',
  {
    articleId: text('article_id')
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    /** `us` | `uk` — one row per accent track. */
    role: text('role').notNull(),
    status: text('status').notNull(),
    voice: text('voice').notNull(),
    contentHash: text('content_hash').notNull(),
    redisKey: text('redis_key').notNull(),
    mimeType: text('mime_type').notNull(),
    durationMs: integer('duration_ms'),
    lastError: text('last_error'),
    generatedAt: timestamp('generated_at'),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.role] })],
);

/** Append-only TTS synthesis audit log (article generate / admin test). */
export const ttsInvocationLog = pgTable(
  'tts_invocation_log',
  {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    status: text('status').notNull(),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    source: text('source').notNull(),
    userId: text('user_id'),
    articleId: text('article_id'),
    voice: text('voice'),
    role: text('role'),
    textPreview: text('text_preview'),
    textLength: integer('text_length'),
    latencyMs: integer('latency_ms'),
    cached: boolean('cached'),
  },
  (table) => [
    index('tts_invocation_log_created_at_idx').on(table.createdAt),
    index('tts_invocation_log_status_created_idx').on(table.status, table.createdAt),
    index('tts_invocation_log_article_created_idx').on(table.articleId, table.createdAt),
  ],
);

export type AiInvocationRequestSummary = {
  messageCount?: number;
  selectionPreview?: string;
  selectionLength?: number;
  toolNames?: string[];
  toolRoundCount?: number;
  actionId?: string;
};

export type AiInvocationResponseSummary = {
  replyPreview?: string;
  replyLength?: number;
};

/** Append-only AI call audit / spend log (one business invoke = one row). */
export const aiInvocationLog = pgTable(
  'ai_invocation_log',
  {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    status: text('status').notNull(),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    purpose: text('purpose'),
    source: text('source').notNull(),
    userId: text('user_id'),
    refType: text('ref_type'),
    refId: text('ref_id'),
    modelRowId: text('model_row_id'),
    providerId: text('provider_id'),
    modelId: text('model_id'),
    baseUrl: text('base_url'),
    latencyMs: integer('latency_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),
    costAmount: numeric('cost_amount', { precision: 18, scale: 8 }),
    costCurrency: text('cost_currency'),
    requestSummary: jsonb('request_summary').$type<AiInvocationRequestSummary>(),
    responseSummary: jsonb('response_summary').$type<AiInvocationResponseSummary>(),
  },
  (table) => [
    index('ai_invocation_log_created_at_idx').on(table.createdAt),
    index('ai_invocation_log_purpose_created_idx').on(table.purpose, table.createdAt),
    index('ai_invocation_log_source_created_idx').on(table.source, table.createdAt),
    index('ai_invocation_log_status_created_idx').on(table.status, table.createdAt),
  ],
);

export const llmProviderRelations = relations(llmProvider, ({ many }) => ({
  models: many(llmModel),
}));

export const llmModelRelations = relations(llmModel, ({ one }) => ({
  provider: one(llmProvider, {
    fields: [llmModel.providerId],
    references: [llmProvider.id],
  }),
}));

/**
 * User-scoped chat transcript SSOT (thread header).
 * Future embeddings / RAG / memory / cache must store pointers to these rows —
 * never duplicate full message bodies in derived tables.
 * `subjectId` is polymorphic (no article FK) so surfaces beyond reading stay possible.
 */
export type ConversationMessageMetadata = {
  actionId?: string;
  selection?: string;
  question?: string;
  suggestions?: string[];
  invocationLogId?: string;
};

export const conversation = pgTable(
  'conversation',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** e.g. assist-read — which product surface owns this thread. */
    surface: text('surface').notNull(),
    /** e.g. article — polymorphic subject kind. */
    subjectType: text('subject_type').notNull(),
    /** Subject id (article id today); no FK — keeps transcripts after subject deletion. */
    subjectId: text('subject_id').notNull(),
    preview: text('preview').notNull().default(''),
    /** Null while open; set when superseded by a newer thread in the same scope. */
    endedAt: timestamp('ended_at'),
    lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('conversation_user_last_msg_idx').on(table.userId, table.lastMessageAt),
    index('conversation_user_scope_last_idx').on(
      table.userId,
      table.surface,
      table.subjectType,
      table.subjectId,
      table.lastMessageAt,
    ),
    index('conversation_user_open_idx')
      .on(table.userId, table.surface, table.subjectType, table.subjectId)
      .where(sql`${table.endedAt} is null`),
  ],
);

/**
 * Append-only learner-visible message rows (transcript body).
 * Stable `id` is the future `source_message_id` for memory_item / embedding_ref / cache_entry.
 * Do not truncate content for storage — audit preview stays on ai_invocation_log only.
 */
export const conversationMessage = pgTable(
  'conversation_message',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    status: text('status').notNull(),
    metadata: jsonb('metadata').$type<ConversationMessageMetadata>().notNull().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('conversation_message_conv_created_idx').on(table.conversationId, table.createdAt)],
);

export const conversationRelations = relations(conversation, ({ one, many }) => ({
  user: one(user, {
    fields: [conversation.userId],
    references: [user.id],
  }),
  messages: many(conversationMessage),
}));

export const conversationMessageRelations = relations(conversationMessage, ({ one }) => ({
  conversation: one(conversation, {
    fields: [conversationMessage.conversationId],
    references: [conversation.id],
  }),
}));
