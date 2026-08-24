import type { ShelfData, ShelfItem } from '@gloaming/shared/api/shelf';

/** Prototype fixture for shelf has-data UI. Not wired to the API yet. */
const mockCurrent: ShelfItem = {
  article: {
    id: 'mock-current',
    title: 'The Art of Noticing',
    level: 'mid',
    themes: ['essay', 'mindfulness'],
    estimatedMinutes: 12,
  },
  progress: {
    status: 'in_progress',
    progressRatio: 45,
    lastReadAt: '2026-08-21T08:00:00.000Z',
    completedAt: null,
  },
};

const mockItems: ShelfItem[] = [
  {
    article: {
      id: 'mock-1',
      title: 'The Little Prince',
      level: 'easy',
      themes: ['story'],
      estimatedMinutes: 8,
    },
    progress: {
      status: 'in_progress',
      progressRatio: 20,
      lastReadAt: '2026-08-20T10:00:00.000Z',
      completedAt: null,
    },
  },
  {
    article: {
      id: 'mock-2',
      title: 'Pride and Prejudice',
      level: 'stretch',
      themes: ['classic', 'society'],
      estimatedMinutes: 15,
    },
    progress: {
      status: 'in_progress',
      progressRatio: 8,
      lastReadAt: '2026-08-19T14:00:00.000Z',
      completedAt: null,
    },
  },
  {
    article: {
      id: 'mock-3',
      title: "A Room of One's Own",
      level: 'mid',
      themes: ['essay'],
      estimatedMinutes: 10,
    },
    progress: {
      status: 'completed',
      progressRatio: 100,
      lastReadAt: '2026-08-18T09:00:00.000Z',
      completedAt: '2026-08-18T09:30:00.000Z',
    },
  },
  {
    article: {
      id: 'mock-4',
      title: 'Walden',
      level: 'mid',
      themes: ['nature'],
      estimatedMinutes: 11,
    },
    progress: {
      status: 'in_progress',
      progressRatio: 0,
      lastReadAt: '2026-08-17T16:00:00.000Z',
      completedAt: null,
    },
  },
  {
    article: {
      id: 'mock-5',
      title: 'Silent Spring',
      level: 'stretch',
      themes: ['science'],
      estimatedMinutes: 14,
    },
    progress: {
      status: 'completed',
      progressRatio: 100,
      lastReadAt: '2026-08-16T11:00:00.000Z',
      completedAt: '2026-08-16T11:40:00.000Z',
    },
  },
];

export const SHELF_MOCK_POPULATED: ShelfData = {
  current: mockCurrent,
  items: mockItems,
};

export const SHELF_MOCK_EMPTY: ShelfData = {
  current: null,
  items: [],
};
