import { relations, sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core';

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
