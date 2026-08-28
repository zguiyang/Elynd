import { describe, expect, it } from 'vitest';

import { buildEnrichMessages } from '@/modules/metadata-enrich/prompt';
import { isShouty, isStopwordTag, isWeakDescription } from '@/modules/metadata-enrich/quality';
import { buildMetadataOutputSchema, cleanCategoryRef, cleanTagRefs } from '@/modules/metadata-enrich/registry';

describe('metadata-enrich quality heuristics', () => {
  it('treats short, generic and shouty descriptions as weak', () => {
    expect(isWeakDescription('')).toBe(true);
    expect(isWeakDescription('A book.')).toBe(true);
    expect(isWeakDescription('THE STORY OF THE GREAT BOOK')).toBe(true);
    expect(isWeakDescription('this book')).toBe(true);
    expect(
      isWeakDescription('A properly long description that actually says something useful about the story content.'),
    ).toBe(false);
  });

  it('filters stopword tags', () => {
    expect(isStopwordTag('Book')).toBe(true);
    expect(isStopwordTag('novel')).toBe(true);
    expect(isStopwordTag('Science Fiction')).toBe(false);
  });

  it('detects shouty text', () => {
    expect(isShouty('THE WOLF IN SHEEP')).toBe(true);
    expect(isShouty('The Wolf in Sheep')).toBe(false);
  });

  it('mentions LCSH prohibition and passes catalog subject hints', () => {
    const messages = buildEnrichMessages({
      title: 'T',
      author: '',
      language: 'en',
      existingTags: [],
      catalogSubjects: ['Fables, Greek -- Translations into English'],
      ruleDescription: '',
      excerpt: 'x'.repeat(200),
      tocTitles: [],
      requiredFields: ['tags'],
    });
    const system = messages.find((m) => m.role === 'system')!.content;
    const user = messages.find((m) => m.role === 'user')!.content;
    expect(system).toContain('LCSH');
    expect(user).toContain('Ebook catalog subjects');
    expect(user).toContain('Fables, Greek -- Translations into English');
  });
});

describe('metadata-enrich prompt (single-book context only)', () => {
  it('contains only the current book and never global catalog data', () => {
    const messages = buildEnrichMessages({
      title: 'The Great Book',
      author: 'Jane Author',
      language: 'en',
      existingTags: ['Science'],
      ruleDescription: '',
      excerpt: 'Chapter one begins…',
      tocTitles: ['Chapter 1', 'Chapter 2'],
      requiredFields: ['description', 'tags', 'category'],
    });

    const system = messages.find((m) => m.role === 'system')!.content;
    const user = messages.find((m) => m.role === 'user')!.content;

    expect(user).toContain('The Great Book');
    expect(user).toContain('Jane Author');
    expect(user).toContain('Chapter one begins');
    expect(system).toContain('list_existing_tags');
    expect(system).toContain('list_categories');
    expect(system).not.toContain('Science Fiction'); // global tag list must not leak
    expect(user).not.toContain('Mystery');
    expect(user).not.toContain('Thriller');
  });

  it('declares required and complete fields so the model fills exactly the gaps', () => {
    const messages = buildEnrichMessages({
      title: 'T',
      author: '',
      language: 'en',
      existingTags: [],
      ruleDescription: '',
      excerpt: 'x'.repeat(200),
      tocTitles: [],
      requiredFields: ['category'],
    });

    const system = messages.find((m) => m.role === 'system')!.content;
    expect(system).toContain('Required fields to fill: category.');
    expect(system).toContain('Already complete, do not output: description, tags.');
    expect(system).toContain('kind:"existing"');
    expect(system).toContain('kind:"new"');
  });

  it('caps the excerpt and TOC titles', () => {
    const messages = buildEnrichMessages({
      title: 'T',
      author: '',
      language: 'en',
      existingTags: [],
      ruleDescription: '',
      excerpt: 'x'.repeat(6000),
      tocTitles: Array.from({ length: 30 }, (_, i) => `Chapter ${i + 1}`),
      requiredFields: ['description'],
    });
    const user = messages.find((m) => m.role === 'user')!.content;
    expect(user.length).toBeLessThan(6000);
    const tocLine = user.split('\n').find((line) => line.startsWith('Chapter 1'));
    expect(tocLine).toBe('Chapter 1');
    expect(user).not.toContain('Chapter 16');
  });
});

describe('metadata-enrich taxonomy refs and dynamic schema', () => {
  it('builds an output schema containing only the required fields, all required', () => {
    const schema = buildMetadataOutputSchema(['category']);
    const shape = schema.shape as Record<string, unknown>;
    expect(Object.keys(shape)).toEqual(['category']);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ category: { kind: 'new', name: 'Fables' } }).success).toBe(true);
    expect(schema.safeParse({ category: null }).success).toBe(true);

    const full = buildMetadataOutputSchema(['description', 'tags', 'category']);
    expect(Object.keys(full.shape as Record<string, unknown>).sort()).toEqual(['category', 'description', 'tags']);
    expect(full.safeParse({ description: 'd', tags: [], category: null }).success).toBe(true);
    expect(full.safeParse({ description: 'd' }).success).toBe(false);
  });

  it('cleanTagRefs keeps reuse ids and drops junk', () => {
    expect(
      cleanTagRefs([
        { kind: 'existing', id: 'tag-1', name: 'Fables' },
        { kind: 'new', name: 'Morality' },
        { kind: 'existing', id: 'tag-2', name: ' ' },
        'not-an-object',
      ]),
    ).toEqual([{ name: 'Fables', existingId: 'tag-1' }, { name: 'Morality' }]);
  });

  it('cleanCategoryRef returns undefined for null/empty', () => {
    expect(cleanCategoryRef(null)).toBeUndefined();
    expect(cleanCategoryRef({ kind: 'existing', id: 'cat-1', name: 'Classic' })).toEqual({
      name: 'Classic',
      existingId: 'cat-1',
    });
    expect(cleanCategoryRef({ kind: 'new', name: '  ' })).toBeUndefined();
  });
});
