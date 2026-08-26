import { describe, expect, it } from 'vitest';

import { buildEnrichMessages } from '@/modules/metadata-enrich/prompt';
import { isShouty, isStopwordTag, isWeakDescription } from '@/modules/metadata-enrich/quality';

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

  it('caps the excerpt and TOC titles', () => {
    const messages = buildEnrichMessages({
      title: 'T',
      author: '',
      language: 'en',
      existingTags: [],
      ruleDescription: '',
      excerpt: 'x'.repeat(6000),
      tocTitles: Array.from({ length: 30 }, (_, i) => `Chapter ${i + 1}`),
    });
    const user = messages.find((m) => m.role === 'user')!.content;
    expect(user.length).toBeLessThan(6000);
    const tocLine = user.split('\n').find((line) => line.startsWith('Chapter 1'));
    expect(tocLine).toBe('Chapter 1');
    expect(user).not.toContain('Chapter 16');
  });
});
