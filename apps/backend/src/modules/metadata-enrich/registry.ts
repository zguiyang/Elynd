import { z, type ZodType } from 'zod';

import {
  AI_DESCRIPTION_MAX,
  AI_TAG_MAX_ITEMS,
  METADATA_FIELD_IDS,
  type MetadataFieldId,
} from '@/modules/metadata-enrich/fields';
import { isStopwordTag, isWeakFieldValue } from '@/modules/metadata-enrich/quality';

/**
 * Extensible per-field definition. Adding a new fillable field (e.g.
 * publishedYear) = register a new MetadataFieldDef; orchestration is untouched.
 */
export type MetadataFieldDef = {
  id: MetadataFieldId;
  /** source stays manual-only in this phase — never sent to the model. */
  aiFillable: boolean;
  /** Prompt section (single-book context only — no global data). */
  promptSection: string;
  /** Key under the structured output object. */
  outputKey: string;
  /** Output validation schema (post-invoke guard rails). */
  schema: ZodType;
  /** Weak-value check — empty/weak fields become fill targets. */
  isWeak(value: string | undefined): boolean;
  normalize(value: unknown): unknown;
};

function cleanTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().slice(0, 40);
    if (!tag || seen.has(tag.toLowerCase()) || isStopwordTag(tag)) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
    if (out.length >= AI_TAG_MAX_ITEMS) break;
  }
  return out.length > 0 ? out : undefined;
}

export const metadataFieldRegistry: Record<MetadataFieldId, MetadataFieldDef> = {
  description: {
    id: 'description',
    aiFillable: true,
    promptSection: 'description: 2-3 sentences in the book language, no spoilers',
    outputKey: 'description',
    schema: z.string().max(AI_DESCRIPTION_MAX).optional(),
    isWeak: isWeakFieldValue,
    normalize(value: unknown): string | undefined {
      if (typeof value !== 'string') return undefined;
      const text = value.replace(/\s+/g, ' ').trim();
      return text ? text.slice(0, AI_DESCRIPTION_MAX) : undefined;
    },
  },
  tags: {
    id: 'tags',
    aiFillable: true,
    promptSection: 'tags: noun phrases, prefer existing tags from list_existing_tags',
    outputKey: 'tags',
    schema: z.array(z.string().min(1).max(40)).max(AI_TAG_MAX_ITEMS).optional(),
    isWeak(value) {
      return !value || !value.trim();
    },
    normalize: cleanTags,
  },
  category: {
    id: 'category',
    aiFillable: true,
    promptSection: 'category: exactly one category from list_categories',
    outputKey: 'category',
    schema: z.string().max(100).optional(),
    isWeak(value) {
      return !value || !value.trim();
    },
    normalize(value: unknown): string | undefined {
      if (typeof value !== 'string') return undefined;
      const text = value.trim();
      return text ? text.slice(0, 100) : undefined;
    },
  },
  source: {
    id: 'source',
    aiFillable: false,
    promptSection: '',
    outputKey: 'source',
    schema: z.string().max(200).optional(),
    isWeak() {
      return false;
    },
    normalize(value: unknown) {
      return typeof value === 'string' ? value.trim() : undefined;
    },
  },
};

export const aiFillableFields = METADATA_FIELD_IDS.filter((id) => metadataFieldRegistry[id].aiFillable);

/** Zod object for withStructuredOutput — only aiFillable fields. */
export function buildMetadataOutputSchema() {
  const shape: Record<string, ZodType> = {};
  for (const id of aiFillableFields) {
    const def = metadataFieldRegistry[id];
    shape[id] = def.schema;
  }
  return z.object(shape);
}
