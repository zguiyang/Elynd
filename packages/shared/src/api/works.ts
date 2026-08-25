import { z } from 'zod';

import {
  buildPaginationMeta,
  createSortByQuerySchema,
  emptyToUndefined,
  paginationMetaSchema,
  paginationQuerySchema,
} from '@gloaming/shared/api/pagination';

export const WORK_STATUSES = ['draft', 'processing', 'published', 'failed'] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_VISIBILITIES = ['catalog', 'private'] as const;
export type WorkVisibility = (typeof WORK_VISIBILITIES)[number];

export const WORK_ORIGIN_KINDS = ['admin_text', 'admin_epub'] as const;
export type WorkOriginKind = (typeof WORK_ORIGIN_KINDS)[number];

export const PART_KINDS = ['chapter', 'body', 'section', 'segment'] as const;
export type PartKind = (typeof PART_KINDS)[number];

export const WORK_TITLE_MAX = 200 as const;
export const WORK_AUTHOR_MAX = 200 as const;
export const WORK_DESCRIPTION_MAX = 2000 as const;
export const WORK_SOURCE_NOTE_MAX = 500 as const;
export const WORK_TAG_MAX_ITEMS = 10 as const;
export const WORK_TAG_MAX_LEN = 40 as const;
/** Max HTML body chars per part — markup inflates plain text ~1.5-2x. */
export const PART_BODY_MAX_CHARS = 1_500_000 as const;

/** Max EPUB upload size (bytes) — enforced by frontend and backend. */
export const EPUB_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

const tagItemSchema = z.string().trim().min(1).max(WORK_TAG_MAX_LEN);
const tagsSchema = z.array(tagItemSchema).max(WORK_TAG_MAX_ITEMS);

/** Public work JSON (catalog / discover — no parts body). */
export const workSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  description: z.string(),
  language: z.string(),
  status: z.enum(WORK_STATUSES),
  visibility: z.enum(WORK_VISIBILITIES),
  originKind: z.enum(WORK_ORIGIN_KINDS),
  tags: z.array(z.string()),
  sourceNote: z.string(),
  coverAssetId: z.string().nullable(),
  publishedAt: z.union([z.string(), z.date()]).nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export type Work = z.infer<typeof workSchema>;

export const partSchema = z.object({
  id: z.string(),
  workId: z.string(),
  sortOrder: z.number().int(),
  kind: z.enum(PART_KINDS),
  title: z.string(),
  body: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export type Part = z.infer<typeof partSchema>;

/** Compact part summary (no body) for reader navigation. */
export const partSummarySchema = partSchema.omit({ body: true });

export type PartSummary = z.infer<typeof partSummarySchema>;

export const DERIVED_KINDS = ['audio'] as const;
export type DerivedKind = (typeof DERIVED_KINDS)[number];

export const DERIVED_STATES = ['missing', 'fresh', 'stale'] as const;
export type DerivedState = (typeof DERIVED_STATES)[number];

export const derivedFreshnessSchema = z.object({
  audio: z.enum(DERIVED_STATES),
});

export type DerivedFreshness = z.infer<typeof derivedFreshnessSchema>;

/** Origin file asset summary (EPUB upload) — surfaced in the admin workflow. */
export const adminOriginAssetSchema = z.object({
  fileName: z.string(),
  size: z.number().int().nonnegative(),
  mimeType: z.string(),
  contentHash: z.string(),
  reused: z.boolean(),
});

export type AdminOriginAsset = z.infer<typeof adminOriginAssetSchema>;

/** Admin work JSON includes derived projection freshness for ops reminders. */
export const adminWorkSchema = workSchema.extend({
  derivedFreshness: derivedFreshnessSchema,
  originMeta: z.record(z.string(), z.unknown()).default({}),
  originAsset: adminOriginAssetSchema.nullable(),
  parts: z.array(partSchema),
});

export type AdminWork = z.infer<typeof adminWorkSchema>;

/**
 * Compact admin list row — no part bodies. `partCount` lets the list show
 * chapter counts without shipping HTML for every part.
 */
export const adminWorkSummarySchema = workSchema.extend({
  derivedFreshness: derivedFreshnessSchema,
  originMeta: z.record(z.string(), z.unknown()).default({}),
  originAsset: adminOriginAssetSchema.nullable(),
  partCount: z.number().int().nonnegative(),
});

export type AdminWorkSummary = z.infer<typeof adminWorkSummarySchema>;

/** Internal admin_text seed — title + body only. */
export const createAdminTextWorkBodySchema = z.object({
  title: z.string().trim().min(1).max(WORK_TITLE_MAX),
  body: z.string().min(1).max(PART_BODY_MAX_CHARS),
});

export type CreateAdminTextWorkBody = z.infer<typeof createAdminTextWorkBodySchema>;

/** Response of `POST /api/admin/works/epub` — upload creates work + origin_file asset. */
export const createEpubWorkResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(WORK_STATUSES),
  originKind: z.enum(WORK_ORIGIN_KINDS),
  originMeta: z.record(z.string(), z.unknown()).default({}),
  asset: z.object({
    storageKey: z.string(),
    mimeType: z.string(),
    contentHash: z.string(),
    size: z.number().int().nonnegative(),
  }),
});

export type CreateEpubWorkResult = z.infer<typeof createEpubWorkResultSchema>;

/** Body of `POST /api/admin/works/epub/reuse` — instant-upload dedupe lookup. */
export const checkEpubWorkReuseBodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/, '文件哈希无效'),
});

export type CheckEpubWorkReuseBody = z.infer<typeof checkEpubWorkReuseBodySchema>;

/** Response of the reuse endpoint — either an instant-created work or a miss. */
export const epubReuseResultSchema = z.discriminatedUnion('duplicated', [
  createEpubWorkResultSchema.extend({ duplicated: z.literal(true) }),
  z.object({ duplicated: z.literal(false) }),
]);

export type EpubReuseResult = z.infer<typeof epubReuseResultSchema>;

export const updateWorkBodySchema = z.object({
  title: z.string().trim().min(1).max(WORK_TITLE_MAX).optional(),
  author: z.string().max(WORK_AUTHOR_MAX).optional(),
  description: z.string().max(WORK_DESCRIPTION_MAX).optional(),
  tags: tagsSchema.optional(),
  sourceNote: z.string().max(WORK_SOURCE_NOTE_MAX).optional(),
});

export type UpdateWorkBody = z.infer<typeof updateWorkBodySchema>;

export const ADMIN_WORK_SORT_FIELDS = ['updatedAt'] as const;
export type AdminWorkSortField = (typeof ADMIN_WORK_SORT_FIELDS)[number];
export const DEFAULT_ADMIN_WORK_SORT_BY = 'updatedAt' as const satisfies AdminWorkSortField;

export const adminWorkListQuerySchema = paginationQuerySchema.extend({
  sortBy: createSortByQuerySchema(ADMIN_WORK_SORT_FIELDS, DEFAULT_ADMIN_WORK_SORT_BY),
  status: z.preprocess(emptyToUndefined, z.enum(WORK_STATUSES).optional()),
});

export type AdminWorkListQuery = z.infer<typeof adminWorkListQuerySchema>;

export const adminWorkListDataSchema = z.object({
  items: z.array(adminWorkSummarySchema),
  pagination: paginationMetaSchema,
});

export type AdminWorkListData = z.infer<typeof adminWorkListDataSchema>;

export const CATALOG_SORT_FIELDS = ['publishedAt', 'updatedAt', 'createdAt'] as const;
export type CatalogSortField = (typeof CATALOG_SORT_FIELDS)[number];
export const DEFAULT_CATALOG_SORT_BY = 'publishedAt' as const satisfies CatalogSortField;

const catalogTagQuerySchema = z.preprocess(emptyToUndefined, z.string().trim().min(1).max(WORK_TAG_MAX_LEN).optional());

const catalogSearchQuerySchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(WORK_TITLE_MAX).optional(),
);

/** Query for `GET /api/catalog/works`. */
export const catalogListQuerySchema = paginationQuerySchema.extend({
  sortBy: createSortByQuerySchema(CATALOG_SORT_FIELDS, DEFAULT_CATALOG_SORT_BY),
  tag: catalogTagQuerySchema,
  q: catalogSearchQuerySchema,
});

export type CatalogListQuery = z.infer<typeof catalogListQuerySchema>;

export const catalogListDataSchema = z.object({
  items: z.array(workSchema),
  pagination: paginationMetaSchema,
  tags: z.array(z.string()),
});

export type CatalogListData = z.infer<typeof catalogListDataSchema>;

export { buildPaginationMeta };

export type PublishWorkIssue = { path: string; message: string };

export function getPublishWorkIssues(work: {
  title: string;
  sourceNote: string;
  tags: string[];
  parts: Array<{ body: string }>;
}): PublishWorkIssue[] {
  const issues: PublishWorkIssue[] = [];

  if (!work.title.trim()) {
    issues.push({ path: 'title', message: '发布前请填写标题' });
  }
  if (!work.sourceNote.trim()) {
    issues.push({ path: 'sourceNote', message: '发布前请填写来源说明' });
  }
  if (work.tags.length < 1) {
    issues.push({ path: 'tags', message: '发布前请至少添加一个标签' });
  }
  if (work.parts.length < 1 || !work.parts.some((part) => part.body.trim())) {
    issues.push({ path: 'body', message: '发布前请填写正文' });
  }

  return issues;
}
