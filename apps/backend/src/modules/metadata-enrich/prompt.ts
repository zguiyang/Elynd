import type { AiMessageInput } from '@/modules/ai';

export const EXCERPT_MAX_CHARS = 2500;
export const TOC_TITLE_MAX = 15;

export type EnrichPromptInput = {
  title: string;
  author: string;
  language: string;
  existingTags: string[];
  ruleDescription: string;
  excerpt: string;
  tocTitles: string[];
};

/**
 * Single-book context only — global tag/category data lives in tools and is
 * fetched on demand, so prompt size stays constant per book (anti-bloat).
 */
export function buildEnrichMessages(input: EnrichPromptInput): AiMessageInput[] {
  const system = [
    'You are a metadata assistant for an English-language reading app.',
    'Produce metadata ONLY from the provided book context. If the excerpt does not support a field, leave it empty — never invent.',
    'Do not include spoilers in the description.',
    'Prefer reusing existing tags from list_existing_tags; only propose a new tag if none accurately describes the work.',
    'The category must come from list_categories.',
    'description: 2-3 sentences in the book language.',
    'tags: noun phrases, up to 6, concise and specific.',
    'Output fields may be omitted when unsupported by the content.',
  ].join('\n');

  const excerpt = input.excerpt.slice(0, EXCERPT_MAX_CHARS);
  const tocTitles = input.tocTitles.slice(0, TOC_TITLE_MAX);

  const context = [
    `Title: ${input.title}`,
    `Author: ${input.author || 'unknown'}`,
    `Language: ${input.language}`,
    input.existingTags.length > 0 ? `Existing tags: ${input.existingTags.join(', ')}` : null,
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
