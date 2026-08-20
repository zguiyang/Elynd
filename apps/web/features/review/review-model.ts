import { REVIEW_DAILY_CAP } from '@gloaming/shared/api/review';

export { REVIEW_DAILY_CAP };

export type ReviewKind = 'cloze' | 'sense';

export type ReviewItem = {
  id: string;
  kind: ReviewKind;
  sentence: string;
  focus: string;
  options: string[];
  hintZh: string;
};

export type ReviewMiss = {
  item: ReviewItem;
  selectedIndex: number;
};

export type ReviewFinishVariant = 'need_completion' | 'empty' | 'complete' | 'exhaust' | 'early' | 'capped';

export type ReviewFinishCopy = {
  title: string;
  sub: string | null;
};

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

export function finishCopy(args: {
  variant: Exclude<ReviewFinishVariant, 'empty' | 'need_completion'>;
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
