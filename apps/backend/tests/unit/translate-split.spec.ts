import { describe, expect, it } from 'vitest';

import { createTranslateLineParser, parseTranslateOutputLine, splitPartSentences } from '@/modules/translate/split';
import { hashPartContent } from '@/modules/works/content-hash';

describe('hashPartContent', () => {
  it('is stable for equivalent whitespace', () => {
    const a = hashPartContent('Hello', 'One.\n\nTwo.');
    const b = hashPartContent('Hello', 'One.\n\n\nTwo.');
    expect(a).toBe(b);
  });

  it('changes when body changes', () => {
    const a = hashPartContent('Hello', 'One.');
    const b = hashPartContent('Hello', 'Two.');
    expect(a).not.toBe(b);
  });
});

describe('splitPartSentences', () => {
  it('splits paragraphs and sentences with global indices', () => {
    const sentences = splitPartSentences('Hello world. Next sentence.\n\nNew paragraph!');
    expect(sentences).toEqual([
      { index: 0, paragraphIndex: 0, en: 'Hello world.' },
      { index: 1, paragraphIndex: 0, en: 'Next sentence.' },
      { index: 2, paragraphIndex: 1, en: 'New paragraph!' },
    ]);
  });

  it('keeps Mr. from hard-splitting', () => {
    const sentences = splitPartSentences('Mr. Smith smiled. Then he left.');
    expect(sentences).toHaveLength(2);
    expect(sentences[0]?.en).toBe('Mr. Smith smiled.');
  });
});

describe('translate line protocol', () => {
  it('parses TITLE and indexed lines', () => {
    expect(parseTranslateOutputLine('TITLE\t狐狸')).toEqual({ kind: 'title', zh: '狐狸' });
    expect(parseTranslateOutputLine('0\t第一句')).toEqual({ kind: 'sentence', index: 0, zh: '第一句' });
  });

  it('streams incomplete lines until newline', () => {
    const parser = createTranslateLineParser();
    expect(parser.push('TITLE\t你好')).toEqual([]);
    expect(parser.push('\n0\t第一')).toEqual([{ kind: 'title', zh: '你好' }]);
    expect(parser.push('句\n')).toEqual([{ kind: 'sentence', index: 0, zh: '第一句' }]);
    expect(parser.flush()).toEqual([]);
  });
});
