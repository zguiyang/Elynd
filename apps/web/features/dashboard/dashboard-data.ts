export const DASHBOARD_FAKE = {
  continueReading: {
    eyebrow: '接着读',
    title: 'The Hidden World of Oceans',
    titleLines: ['The Hidden World', 'of Oceans'] as const,
    blurb: '你正在读的这篇。打开就能继续，卡住了再查。',
    meta: ['B1', '约 15 分钟', '可读可听'] as const,
    progress: 33,
    coverSrc: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600',
    coverAlt: 'Ocean surface at dusk',
  },
  inProgress: {
    title: 'The Psychology of Habits',
    subtitle: 'Chapter 3 · How habits are formed',
    progress: 68,
    coverSrc: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400',
    coverAlt: 'Open notebook and pen',
  },
  recommendations: [
    {
      title: 'The Science of Sleep',
      meta: 'B1 · 科学探索',
      coverSrc: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=300',
      coverAlt: 'Books stacked on a table',
    },
    {
      title: 'Small Changes',
      meta: 'A2 · 生活方式',
      coverSrc: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=300',
      coverAlt: 'Forest path in soft light',
    },
  ],
  stats: [
    { value: '12', label: '天有读过' },
    { value: '28', label: '篇碰过' },
    { value: '6h', label: '大概读了多久' },
  ],
} as const;

export function greetingForHour(hour: number, name: string): string {
  if (hour < 5) {
    return `夜深了，${name}`;
  }
  if (hour < 11) {
    return `早上好，${name}`;
  }
  if (hour < 14) {
    return `中午好，${name}`;
  }
  if (hour < 18) {
    return `下午好，${name}`;
  }
  return `晚上好，${name}`;
}
