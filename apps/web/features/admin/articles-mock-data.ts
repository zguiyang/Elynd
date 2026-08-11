export type ArticleStatus = 'draft' | 'published';

export type MockArticle = {
  id: string;
  title: string;
  body: string;
  level: 'easy' | 'mid' | 'stretch';
  themes: string[];
  sourceNote: string;
  status: ArticleStatus;
  seriesId: string | null;
  seriesOrder: number | null;
  estimatedMinutes: number | null;
  updatedAt: string;
};

const SAMPLE_BODY = `The rain started just as Maya reached the corner. She looked up, then down at her empty hands. No umbrella.

A stranger in a blue coat stopped beside her. "Wrong umbrella?" he asked, holding out a small black one that was not his.

Maya smiled. "Maybe the right one for now." They shared the short walk to the bus stop, saying almost nothing. The rain was loud enough for both of them.

When the bus came, she returned the umbrella. He shook his head. "Keep it. The sky still has plans."

She kept it. At home she left it by the door, still a little wet, like a quiet promise that strangers can be kind.`;

/** Static catalog for admin UI shells — not an API. */
export const MOCK_ARTICLES: MockArticle[] = [
  {
    id: '1',
    title: 'The Wrong Umbrella',
    body: SAMPLE_BODY,
    level: 'easy',
    themes: ['故事'],
    sourceNote: '原创短叙事',
    status: 'published',
    seriesId: 'rainy-corners',
    seriesOrder: 1,
    estimatedMinutes: 6,
    updatedAt: '2026-08-10T09:00:00.000Z',
  },
  {
    id: '2',
    title: 'Two Minutes Late',
    body: SAMPLE_BODY,
    level: 'easy',
    themes: ['故事', '情景'],
    sourceNote: '原创短叙事',
    status: 'published',
    seriesId: null,
    seriesOrder: null,
    estimatedMinutes: 5,
    updatedAt: '2026-08-09T14:20:00.000Z',
  },
  {
    id: '3',
    title: "The Neighbor's Piano",
    body: SAMPLE_BODY,
    level: 'easy',
    themes: ['故事'],
    sourceNote: '原创短叙事',
    status: 'draft',
    seriesId: null,
    seriesOrder: null,
    estimatedMinutes: 7,
    updatedAt: '2026-08-08T11:00:00.000Z',
  },
  {
    id: '4',
    title: 'Fox and the App Notification',
    body: SAMPLE_BODY,
    level: 'easy',
    themes: ['故事'],
    sourceNote: '寓言现代化改写',
    status: 'draft',
    seriesId: null,
    seriesOrder: null,
    estimatedMinutes: 6,
    updatedAt: '2026-08-07T16:40:00.000Z',
  },
  {
    id: '5',
    title: 'Trying On a Jacket',
    body: SAMPLE_BODY,
    level: 'easy',
    themes: ['情景'],
    sourceNote: '情景融入故事草稿',
    status: 'published',
    seriesId: null,
    seriesOrder: null,
    estimatedMinutes: 5,
    updatedAt: '2026-08-06T08:15:00.000Z',
  },
  {
    id: '6',
    title: 'Bus Stop Small Talk',
    body: SAMPLE_BODY,
    level: 'easy',
    themes: ['情景', '故事'],
    sourceNote: '外部 AI 草稿，已人工润色',
    status: 'draft',
    seriesId: 'rainy-corners',
    seriesOrder: 2,
    estimatedMinutes: 5,
    updatedAt: '2026-08-05T19:00:00.000Z',
  },
  {
    id: '7',
    title: 'The Quiet Library Window',
    body: SAMPLE_BODY,
    level: 'mid',
    themes: ['故事'],
    sourceNote: '原创',
    status: 'published',
    seriesId: null,
    seriesOrder: null,
    estimatedMinutes: 8,
    updatedAt: '2026-08-04T10:30:00.000Z',
  },
  {
    id: '8',
    title: 'Coffee Without Sugar',
    body: SAMPLE_BODY,
    level: 'easy',
    themes: ['情景'],
    sourceNote: '原创',
    status: 'draft',
    seriesId: null,
    seriesOrder: null,
    estimatedMinutes: 4,
    updatedAt: '2026-08-03T13:45:00.000Z',
  },
  {
    id: '9',
    title: 'A Map Folded Twice',
    body: SAMPLE_BODY,
    level: 'easy',
    themes: ['故事'],
    sourceNote: '原创',
    status: 'published',
    seriesId: null,
    seriesOrder: null,
    estimatedMinutes: 6,
    updatedAt: '2026-08-02T07:20:00.000Z',
  },
  {
    id: '10',
    title: 'Shoes by the Door',
    body: SAMPLE_BODY,
    level: 'easy',
    themes: ['故事'],
    sourceNote: '原创',
    status: 'draft',
    seriesId: null,
    seriesOrder: null,
    estimatedMinutes: 5,
    updatedAt: '2026-08-01T21:10:00.000Z',
  },
  {
    id: '11',
    title: 'The Last Elevator Button',
    body: SAMPLE_BODY,
    level: 'mid',
    themes: ['情景'],
    sourceNote: '外部 AI 草稿，已人工润色',
    status: 'published',
    seriesId: null,
    seriesOrder: null,
    estimatedMinutes: 7,
    updatedAt: '2026-07-30T12:00:00.000Z',
  },
  {
    id: '12',
    title: 'Morning Bread Line',
    body: SAMPLE_BODY,
    level: 'easy',
    themes: ['故事', '情景'],
    sourceNote: '原创',
    status: 'draft',
    seriesId: null,
    seriesOrder: null,
    estimatedMinutes: 6,
    updatedAt: '2026-07-28T09:55:00.000Z',
  },
];

export function getMockArticle(id: string): MockArticle | undefined {
  return MOCK_ARTICLES.find((article) => article.id === id);
}

export function emptyArticleFormValues(): Omit<MockArticle, 'id' | 'updatedAt' | 'status'> & {
  status: ArticleStatus;
} {
  return {
    title: '',
    body: '',
    level: 'easy',
    themes: [],
    sourceNote: '',
    status: 'draft',
    seriesId: null,
    seriesOrder: null,
    estimatedMinutes: null,
  };
}
