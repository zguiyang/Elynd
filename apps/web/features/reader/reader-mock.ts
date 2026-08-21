/**
 * Reader UI prototype fixtures — not wired to catalog/progress/assist APIs.
 * Shape mirrors a future book+chapter reader payload so getters can swap later.
 */

import type {
  ReaderChapterBody,
  ReaderChapterMeta,
  ReaderParagraph,
  ReaderSession,
} from '@/features/reader/reader-model';

const CHAPTER_DEFS: Array<{ id: string; title: string; paragraphs: string[] }> = [
  {
    id: 'ch-1',
    title: 'Chapter I: The Silent Shore',
    paragraphs: [
      "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.",
      '"Whenever you feel like criticizing anyone," he told me, "just remember that all the people in this world haven\'t had the advantages that you\'ve had."',
      "He didn't say any more, but we've always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that.",
      "In consequence, I'm inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.",
      'The abnormal mind is quick to detect and attach itself to this quality when it appears in a normal person, and so it came about that in college I was unjustly accused of being a politician, because I was privy to the secret griefs of wild, unknown men.',
    ],
  },
  {
    id: 'ch-2',
    title: 'Chapter II: The Green Light',
    paragraphs: [
      'About half way between West Egg and New York the motor road hastily joins the railroad and runs beside it for a quarter of a mile, so as to shrink away from a certain desolate area of land.',
      'This is a valley of ashes—a fantastic farm where ashes grow like wheat into ridges and hills and grotesque gardens; where ashes take the forms of houses and chimneys and rising smoke and, finally, with a transcendent effort, of ash-grey men who move dimly and already crumbling through the powdery air.',
      'Occasionally a line of grey cars crawls along an invisible track, gives out a ghastly creak, and comes to rest, and immediately the ash-grey men swarm up with leaden spades and stir up an impenetrable cloud.',
      'But above the grey land and the spasms of bleak dust which drift endlessly over it, you perceive, after a moment, the eyes of Doctor T. J. Eckleburg.',
    ],
  },
  {
    id: 'ch-3',
    title: 'Chapter III: The Party',
    paragraphs: [
      "There was music from my neighbor's house through the summer nights. In his blue gardens men and girls came and went like moths among the whisperings and the champagne and the stars.",
      "By seven o'clock the orchestra has arrived, no thin five-piece affair, but a whole pitful of oboes and trombones and saxophones and viols and cornets and piccolos, and low and high drums.",
      'The lights grow brighter as the earth lurches away from the sun, and now the orchestra is playing yellow cocktail music, and the opera of voices pitches a key higher.',
      'Suddenly one of these gypsies, in trembling opal, seizes a cocktail out of the air, dumps it down for courage and, moving her hands like Frisco, dances out alone on the canvas platform.',
      "I believe that on the first night I went to Gatsby's house I was one of the few guests who had actually been invited. People were not invited—they went there.",
    ],
  },
  {
    id: 'ch-4',
    title: 'Chapter IV: The Return',
    paragraphs: [
      "On Sunday morning while church bells rang in the villages alongshore, the world and its mistress returned to Gatsby's house and twinkled hilariously on his front lawn.",
      "I found myself on Gatsby's side, and alone. From the moment I arrived there I had the sense of being at a place that was not quite real—a stage set for a play that never began.",
      'We passed a barrier of dark trees, and then the facade of Fifty-ninth Street, a block of delicate pale light, bloomed out into the soft night.',
      'So we drove on toward death through the cooling twilight.',
    ],
  },
];

/** Known prototype book titles keyed by shelf / discover / detail mock ids. */
const BOOK_TITLES: Record<string, string> = {
  'mock-current': 'The Art of Noticing',
  'mock-1': 'The Little Prince',
  'mock-2': 'Pride and Prejudice',
  'mock-3': 'The Great Gatsby',
  'discover-1': 'The Architecture of Tomorrow',
  'discover-2': 'Whispers of the Old City',
  'discover-3': 'The Art of Stillness',
  'discover-4': 'Roots and Canopies',
  'discover-5': 'Echoes of the Vanguard',
};

function paragraphsFor(chapterId: string, texts: string[]): ReaderParagraph[] {
  return texts.map((text, i) => ({
    id: `${chapterId}-p${i + 1}`,
    index: i + 1,
    text,
  }));
}

function buildChapterBody(defIndex: number, status: ReaderChapterMeta['status']): ReaderChapterBody {
  const def = CHAPTER_DEFS[defIndex]!;
  return {
    id: def.id,
    index: defIndex + 1,
    title: def.title,
    status,
    paragraphs: paragraphsFor(def.id, def.paragraphs),
  };
}

function chapterMetas(currentIndex: number): ReaderChapterMeta[] {
  return CHAPTER_DEFS.map((def, i) => ({
    id: def.id,
    index: i + 1,
    title: def.title,
    status: i < currentIndex ? 'read' : i === currentIndex ? 'current' : 'unread',
  }));
}

/**
 * Resolve a reader session for a book id.
 * Returns null when content is unavailable (prototype).
 */
export function getReaderSession(
  bookId: string,
  options?: { chapterId?: string | null; forceUnavailable?: boolean },
): ReaderSession | null {
  if (options?.forceUnavailable || bookId === 'unavailable') {
    return null;
  }

  const title = BOOK_TITLES[bookId] ?? 'The Great Gatsby';
  let currentIndex = 2;
  if (options?.chapterId) {
    const found = CHAPTER_DEFS.findIndex((c) => c.id === options.chapterId);
    if (found >= 0) currentIndex = found;
  }

  const chapter = buildChapterBody(currentIndex, 'current');
  const chapters = chapterMetas(currentIndex);
  const firstParagraph = chapter.paragraphs[0] ?? null;

  return {
    book: {
      id: bookId,
      title,
      chapterCount: CHAPTER_DEFS.length,
    },
    chapter,
    chapters,
    progress: {
      chapterId: chapter.id,
      paragraphId: firstParagraph?.id ?? null,
      offsetRatio: currentIndex === 2 ? 0.35 : 0.05,
      updatedAt: '2026-08-21T10:00:00.000Z',
    },
    audio: {
      status: 'idle',
      label: `Playing ${chapter.title.split(':')[0] ?? 'Chapter'}`,
    },
    ai: {
      messages: [],
      suggestions: ['Explain this passage in simpler English', 'What does this metaphor mean?'],
    },
  };
}

/** Switch chapter within the same book mock (keeps book id/title). */
export function getReaderChapter(bookId: string, chapterId: string): ReaderSession | null {
  return getReaderSession(bookId, { chapterId });
}

export function getReaderUnavailableSuggestions(): Array<{ id: string; title: string; author: string }> {
  return [
    { id: 'discover-2', title: 'Whispers of the Old City', author: 'David Chen' },
    { id: 'discover-3', title: 'The Art of Stillness', author: 'Elena Rostova' },
    { id: 'discover-1', title: 'The Architecture of Tomorrow', author: 'Sarah Jenkins' },
    { id: 'discover-4', title: 'Roots and Canopies', author: 'Thomas Birch' },
  ];
}
