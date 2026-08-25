import type { AdminWork, Work } from '@gloaming/shared/api/works';

/** Work view model: dates as ISO strings. */
export type WorkView = {
  id: string;
  title: string;
  author: string;
  description: string;
  language: string;
  status: Work['status'];
  visibility: Work['visibility'];
  originKind: Work['originKind'];
  tags: string[];
  sourceNote: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminWorkView = WorkView & {
  derivedFreshness: AdminWork['derivedFreshness'];
  originMeta: AdminWork['originMeta'];
  parts: AdminWork['parts'];
};

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

export function normalizeWork(raw: Work): WorkView {
  return {
    id: raw.id,
    title: raw.title,
    author: raw.author,
    description: raw.description,
    language: raw.language,
    status: raw.status,
    visibility: raw.visibility,
    originKind: raw.originKind,
    tags: raw.tags,
    sourceNote: raw.sourceNote,
    publishedAt: raw.publishedAt == null ? null : toIso(raw.publishedAt),
    createdAt: toIso(raw.createdAt),
    updatedAt: toIso(raw.updatedAt),
  };
}

export function normalizeAdminWork(raw: AdminWork): AdminWorkView {
  return {
    ...normalizeWork(raw),
    derivedFreshness: raw.derivedFreshness,
    originMeta: raw.originMeta,
    parts: raw.parts,
  };
}
