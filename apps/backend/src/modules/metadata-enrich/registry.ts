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

/**
 * Taxonomy decision output — the model declares reuse (with the id from the
 * tools) or creation. The server treats this as intent only: existing ids are
 * validated, and names always fall back to normalized reuse-first upserts.
 */
export const taxonomyRefSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('existing'),
    id: z.string().min(1).describe('id returned by list_existing_tags / list_categories'),
    name: z.string().min(1).max(100),
  }),
  z.object({ kind: z.literal('new'), name: z.string().min(1).max(100) }),
]);

export type TaxonomyRef = z.infer<typeof taxonomyRefSchema>;

/** Clean, dedupe and cap an array of taxonomy refs; returns name + existingId. */
export function cleanTagRefs(value: unknown): Array<{ name: string; existingId?: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: Array<{ name: string; existingId?: string }> = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const ref = raw as Partial<TaxonomyRef>;
    const name = typeof ref.name === 'string' ? ref.name.trim().slice(0, 100) : '';
    if (!name || seen.has(name.toLowerCase()) || isStopwordTag(name)) continue;
    seen.add(name.toLowerCase());
    out.push({
      name: name.slice(0, 40),
      ...(ref.kind === 'existing' && typeof ref.id === 'string' && ref.id ? { existingId: ref.id } : {}),
    });
    if (out.length >= AI_TAG_MAX_ITEMS) break;
  }
  return out.length > 0 ? out : undefined;
}

export function cleanCategoryRef(value: unknown): { name: string; existingId?: string } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const ref = value as Partial<TaxonomyRef>;
  const name = typeof ref.name === 'string' ? ref.name.trim().slice(0, 100) : '';
  if (!name) return undefined;
  return {
    name,
    ...(ref.kind === 'existing' && typeof ref.id === 'string' && ref.id ? { existingId: ref.id } : {}),
  };
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
    schema: z.array(taxonomyRefSchema).max(AI_TAG_MAX_ITEMS).optional(),
    /** Prefer `areProductTagsWeak(names[])` in orchestration — joined string is best-effort. */
    isWeak(value) {
      return !value || !value.trim();
    },
    normalize: cleanTagRefs,
  },
  category: {
    id: 'category',
    aiFillable: true,
    promptSection: 'category: one category, prefer existing from list_categories',
    outputKey: 'category',
    schema: z.union([taxonomyRefSchema, z.null()]).optional(),
    isWeak(value) {
      return !value || !value.trim();
    },
    normalize: cleanCategoryRef,
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

/**
 * Zod object for withStructuredOutput — built from the fields this run must
 * fill. Fields already complete are absent entirely, and required fields are
 * mandatory: the model cannot skip them, which is the fix for silent omission.
 */
export function buildMetadataOutputSchema(requiredFields: MetadataFieldId[]) {
  const shape: Record<string, ZodType> = {};
  for (const id of requiredFields) {
    const def = metadataFieldRegistry[id];
    if (!def.aiFillable) continue;
    const base = def.schema;
    shape[id] = (base instanceof z.ZodOptional ? base.unwrap() : base) as ZodType;
  }
  return z.object(shape);
}
