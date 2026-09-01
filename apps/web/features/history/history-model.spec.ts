import { describe, expect, it } from 'vitest';

import {
  countHistoryActivityDays,
  formatHistoryCalendarDate,
  HISTORY_ACTIVITY_MAX_LEVEL,
  toHistoryActivityCalendarData,
} from './history-model';

describe('history-model activity calendar', () => {
  it('formats calendar dates in Chinese', () => {
    expect(formatHistoryCalendarDate('2026-01-15')).toBe('2026年1月15日');
  });

  it('anchors a year window and marks reading days at full intensity', () => {
    const data = toHistoryActivityCalendarData('2026-09-01', [
      { date: '2026-09-01' },
      { date: '2026-08-30' },
      { date: '2024-01-01' },
    ]);

    expect(data[0]?.date).toBe('2025-09-02');
    expect(data.at(-1)?.date).toBe('2026-09-01');
    expect(data.find((day) => day.date === '2026-08-30')).toEqual({
      date: '2026-08-30',
      count: 1,
      level: HISTORY_ACTIVITY_MAX_LEVEL,
    });
    expect(data.some((day) => day.date === '2024-01-01')).toBe(false);
    expect(countHistoryActivityDays([{ date: '2026-09-01' }, { date: '2024-01-01' }], '2026-09-01')).toBe(1);
  });
});
