export const REVIEW_DAILY_CAP = 10;
export const REVIEW_DAILY_GATE_KEY = 'elynd.review.daily.v2';

export type ReviewKind = 'cloze' | 'sense';

export type ReviewItem = {
  id: string;
  kind: ReviewKind;
  sentence: string;
  focus: string;
  options: string[];
  correctIndex: number;
  hintZh: string;
};

export type ReviewMiss = {
  item: ReviewItem;
  selectedIndex: number;
};

export type ReviewFinishVariant = 'empty' | 'complete' | 'exhaust' | 'early' | 'capped';

export type ReviewFinishCopy = {
  title: string;
  sub: string | null;
};

/** Stub queue until a re-meet API exists. Cap is an upper bound, not a quota to pad. */
export const REVIEW_STUB = {
  articleId: '00000000-0000-4000-8000-000000000001',
  articleTitle: 'The Hidden World of Oceans',
  paragraphs: [
    'The ocean is full of mysteries.',
    "Ocean covers more than 70 percent of Earth's surface.",
    'There is a hidden world beneath the waves.',
    'A warm current carries nutrients across the basin.',
    'Sunlight fades quickly below the surface.',
    'Light cannot reach the deepest trenches.',
    'Tiny plants drift in the open water.',
    'Whales follow the same path each year.',
  ],
  items: [
    {
      id: 'mysteries',
      kind: 'cloze',
      sentence: 'The ocean is full of mysteries.',
      focus: 'mysteries',
      options: ['trenches', 'mysteries', 'nutrients', 'plants'],
      correctIndex: 1,
      hintZh: '说不清的事。',
    },
    {
      id: 'covers',
      kind: 'sense',
      sentence: "Ocean covers more than 70 percent of Earth's surface.",
      focus: 'covers',
      options: ['封面', '覆盖', '报道'],
      correctIndex: 1,
      hintZh: '铺在表面。',
    },
    {
      id: 'hidden',
      kind: 'cloze',
      sentence: 'There is a hidden world beneath the waves.',
      focus: 'hidden',
      options: ['tiny', 'open', 'hidden', 'warm'],
      correctIndex: 2,
      hintZh: '看不见的。',
    },
    {
      id: 'current',
      kind: 'sense',
      sentence: 'A warm current carries nutrients across the basin.',
      focus: 'current',
      options: ['现在', '电流', '洋流'],
      correctIndex: 2,
      hintZh: '洋流。',
    },
    {
      id: 'surface',
      kind: 'cloze',
      sentence: 'Sunlight fades quickly below the surface.',
      focus: 'surface',
      options: ['basin', 'surface', 'path'],
      correctIndex: 1,
      hintZh: '海面。',
    },
    {
      id: 'waves',
      kind: 'sense',
      sentence: 'There is a hidden world beneath the waves.',
      focus: 'waves',
      options: ['挥手', '海浪', '电波'],
      correctIndex: 1,
      hintZh: '海浪。',
    },
    {
      id: 'nutrients',
      kind: 'cloze',
      sentence: 'A warm current carries nutrients across the basin.',
      focus: 'nutrients',
      options: ['whales', 'percent', 'nutrients', 'mysteries'],
      correctIndex: 2,
      hintZh: '养分。',
    },
    {
      id: 'percent',
      kind: 'sense',
      sentence: "Ocean covers more than 70 percent of Earth's surface.",
      focus: 'percent',
      options: ['礼物', '百分之七十', '味道'],
      correctIndex: 1,
      hintZh: '比例。',
    },
    {
      id: 'trenches',
      kind: 'cloze',
      sentence: 'Light cannot reach the deepest trenches.',
      focus: 'trenches',
      options: ['plants', 'trenches', 'path', 'mysteries'],
      correctIndex: 1,
      hintZh: '海沟。',
    },
    {
      id: 'sunlight',
      kind: 'sense',
      sentence: 'Sunlight fades quickly below the surface.',
      focus: 'sunlight',
      options: ['人造灯', '月光', '阳光'],
      correctIndex: 2,
      hintZh: '日光。',
    },
  ] satisfies ReviewItem[],
};

export function reviewQueue(items: ReviewItem[]): ReviewItem[] {
  return items.slice(0, REVIEW_DAILY_CAP);
}

export function todayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isSameDayGate(raw: string | null, today: string): boolean {
  if (!raw) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw) as { day?: unknown };
    return parsed.day === today;
  } catch {
    return false;
  }
}

export function dailyGatePayload(today: string): string {
  return JSON.stringify({ day: today });
}

export function splitFocus(sentence: string, focus: string): { before: string; match: string; after: string } | null {
  const start = sentence.toLowerCase().indexOf(focus.toLowerCase());
  if (start < 0) {
    return null;
  }
  const end = start + focus.length;
  return {
    before: sentence.slice(0, start),
    match: sentence.slice(start, end),
    after: sentence.slice(end),
  };
}

export function checkLine(item: ReviewItem, selectedIndex: number): { isHit: boolean; line: string | null } {
  const isHit = selectedIndex === item.correctIndex;
  if (isHit) {
    return { isHit: true, line: null };
  }
  const picked = item.options[selectedIndex] ?? '';
  const correct = item.options[item.correctIndex] ?? item.focus;
  return {
    isHit: false,
    line: `是「${correct}」，不是「${picked}」。`,
  };
}

export function finishCopy(args: {
  variant: Exclude<ReviewFinishVariant, 'empty'>;
  missCount: number;
  total: number;
}): ReviewFinishCopy {
  const { variant, missCount, total } = args;

  if (variant === 'capped') {
    return { title: '今天够了', sub: '明天再来。' };
  }

  if (variant === 'early') {
    return { title: '先这样', sub: null };
  }

  const sub = variant === 'exhaust' ? null : '明天再来。';

  if (missCount === 0) {
    return { title: '今天挺顺', sub };
  }

  if (total > 0 && missCount * 2 >= total) {
    return { title: '这篇还早', sub };
  }

  return { title: '有几句还不熟', sub };
}
