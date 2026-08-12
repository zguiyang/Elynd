import { LEARN_DEMO } from '@/constants';

/**
 * Prototype / stub static content for Learn Room + Practice.
 * No API — used only to walk the Today → read → practice → Today loop.
 */

export type LearnPracticeQuestion =
  | {
      kind: 'comprehension';
      prompt: string;
      options: readonly string[];
    }
  | {
      kind: 'vocab';
      word: string;
      hint: string;
      quote: string;
      options: readonly string[];
    };

export type LearnStaticArticle = {
  id: string;
  title: string;
  titleLines?: readonly string[];
  levelLabel: string;
  estimatedMinutes: number;
  eyebrow: string;
  paragraphs: readonly string[];
  practiceIntro: string;
  practiceQuestions: readonly LearnPracticeQuestion[];
};

export const LEARN_STATIC_ARTICLES: Record<string, LearnStaticArticle> = {
  [LEARN_DEMO.oceans]: {
    id: LEARN_DEMO.oceans,
    title: 'The Hidden World of Oceans',
    titleLines: ['The Hidden World', 'of Oceans'],
    levelLabel: 'B1',
    estimatedMinutes: 15,
    eyebrow: '阅读 · 演示',
    paragraphs: [
      "The ocean covers more than 70 percent of Earth's surface. It is a vast world full of mysteries and hidden life.",
      'Scientists continue to explore the deep ocean and discover new creatures that have never been seen before.',
      'Learning about the ocean helps us understand our planet better.',
    ],
    practiceIntro: '刚读过海洋那篇。下面几题只帮你确认理解，不是考试。',
    practiceQuestions: [
      {
        kind: 'comprehension',
        prompt: 'What is the main idea of this article?',
        options: [
          'A. Ocean animals are dangerous',
          'B. Oceans contain a huge unknown world',
          'C. Scientists stopped exploring oceans',
        ],
      },
      {
        kind: 'vocab',
        word: 'mystery',
        hint: '在这篇文章里，它更接近哪个意思？',
        quote: '“The ocean is full of mysteries.”',
        options: ['秘密 / 未解之处', '速度', '颜色', '声音'],
      },
      {
        kind: 'comprehension',
        prompt: 'Why do people study the ocean, according to the text?',
        options: ['A. To understand our planet better', 'B. To win a swimming race', 'C. To build more ships only'],
      },
    ],
  },
  [LEARN_DEMO.habits]: {
    id: LEARN_DEMO.habits,
    title: 'The Psychology of Habits',
    levelLabel: 'B1',
    estimatedMinutes: 12,
    eyebrow: '阅读 · 演示',
    paragraphs: [
      'Habits are small actions we repeat almost without thinking. Over time, they shape much of our daily life.',
      'Many habits start with a simple cue: a time of day, a place, or a feeling. Then comes the action, and later a small reward.',
      'Understanding this loop can help us change habits gently—one small step at a time, without shame.',
    ],
    practiceIntro: '刚读过习惯那篇。几道小题确认一下看懂了没有——不想练也可以跳过。',
    practiceQuestions: [
      {
        kind: 'comprehension',
        prompt: 'What does the article say habits often start with?',
        options: ['A. A simple cue', 'B. A long exam', 'C. A public leaderboard'],
      },
      {
        kind: 'vocab',
        word: 'gently',
        hint: '在这篇文章里，它更接近哪个意思？',
        quote: '“change habits gently—one small step at a time”',
        options: ['温柔地 / 不猛烈地', '很快地', '公开地', '昂贵地'],
      },
      {
        kind: 'comprehension',
        prompt: 'What tone does the article take toward changing habits?',
        options: ['A. Soft and gradual, without shame', 'B. Strict daily punishment', 'C. Only for athletes'],
      },
    ],
  },
};

export function getLearnStaticArticle(articleId: string): LearnStaticArticle | null {
  return LEARN_STATIC_ARTICLES[articleId] ?? null;
}
