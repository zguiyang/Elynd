import type { AiMessageInput } from '@/modules/ai';
import type { MetadataFieldId } from '@/modules/metadata-enrich/fields';

export const EXCERPT_MAX_CHARS = 2500;
export const TOC_TITLE_MAX = 15;

export type EnrichPromptInput = {
  title: string;
  author: string;
  language: string;
  existingTags: string[];
  /** Raw EPUB dc:subject strings — hints only; never copy LCSH verbatim into tags. */
  catalogSubjects?: string[];
  ruleDescription: string;
  excerpt: string;
  tocTitles: string[];
  /** Fields missing/weak that this run must fill — everything else is off-limits. */
  requiredFields: MetadataFieldId[];
};

const FIELD_LABEL: Record<MetadataFieldId, string> = {
  description: 'description',
  tags: 'tags',
  category: 'category',
  source: 'source',
};

/**
 * Single-book context only — global tag/category data lives in tools and is
 * fetched on demand, so prompt size stays constant per book (anti-bloat).
 * The required/complete split makes the one-shot fill task explicit: the model
 * knows exactly which fields to output and which are already settled.
 */
export function buildEnrichMessages(input: EnrichPromptInput): AiMessageInput[] {
  const required = input.requiredFields.map((id) => FIELD_LABEL[id]);
  const complete = (Object.keys(FIELD_LABEL) as MetadataFieldId[]).filter(
    (id) => id !== 'source' && !input.requiredFields.includes(id),
  );

  const system = [
    'You are a metadata assistant for an English-language reading app.',
    'Produce metadata ONLY from the provided book context. If the excerpt does not support a field, leave it empty — never invent.',
    'Do not include spoilers in the description.',
    required.length > 0 ? `Required fields to fill: ${required.join(', ')}.` : null,
    complete.length > 0 ? `Already complete, do not output: ${complete.join(', ')}.` : null,
    'For tags and category: prefer reusing entries from the tools (list_existing_tags / list_categories) — return kind:"existing" with the id from the tool. Only return kind:"new" when nothing existing accurately fits.',
    'description: 2-3 sentences in the book language.',
    'tags: noun phrases, up to 6, concise and specific — never copy library catalog headings (LCSH) or strings with "--".',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const excerpt = input.excerpt.slice(0, EXCERPT_MAX_CHARS);
  const tocTitles = input.tocTitles.slice(0, TOC_TITLE_MAX);

  const context = [
    `Title: ${input.title}`,
    `Author: ${input.author || 'unknown'}`,
    `Language: ${input.language}`,
    input.existingTags.length > 0 ? `Existing tags: ${input.existingTags.join(', ')}` : null,
    input.catalogSubjects && input.catalogSubjects.length > 0
      ? `Ebook catalog subjects (hints only — do not copy verbatim): ${input.catalogSubjects.join('; ')}`
      : null,
    input.ruleDescription ? `Existing description: ${input.ruleDescription}` : null,
    '',
    '--- Excerpt (start of reading content) ---',
    excerpt || '(empty)',
    '--- End of excerpt ---',
    tocTitles.length > 0 ? `--- Table of contents ---\n${tocTitles.join('\n')}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: context },
  ];
}
