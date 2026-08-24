import type { ReadingHistoryCompletion, ReadingHistoryData } from '@gloaming/shared/api/reading-history';

export type HistoryViewModel = {
  today: string;
  portrait: {
    consecutiveDays: number;
    readingDays: number;
    completedWorks: number;
    lookedUpWords: number;
  };
  activity: Array<{ date: string; level: 1 }>;
  completions: ReadingHistoryCompletion[];
};

export function toHistoryViewModel(data: ReadingHistoryData): HistoryViewModel {
  return {
    today: data.today,
    portrait: data.portrait,
    activity: data.activity,
    completions: data.completions,
  };
}
