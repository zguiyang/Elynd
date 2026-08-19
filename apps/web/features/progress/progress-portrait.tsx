import type { ProgressPortrait } from '@/features/progress/progress-model';

const PORTRAIT_ITEMS: { key: keyof ProgressPortrait; label: string }[] = [
  { key: 'consecutiveDays', label: '最近连续打开（天）' },
  { key: 'learningDays', label: '一共来过（天）' },
  { key: 'completedArticles', label: '读完的短文（篇）' },
  { key: 'lookedUpWords', label: '查过的词' },
  { key: 'reviewCount', label: '再碰（次）' },
  { key: 'practiceCount', label: '做过的小题' },
];

type ProgressPortraitGridProps = {
  portrait: ProgressPortrait;
};

/**
 * Quiet counts — time with language, not a scoreboard. Words are lookups, not mastery.
 */
export function ProgressPortraitGrid({ portrait }: ProgressPortraitGridProps) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3">
      {PORTRAIT_ITEMS.map((item) => (
        <div key={item.key}>
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="font-heading mt-1 text-3xl font-bold tracking-tight tabular-nums">{portrait[item.key]}</dd>
        </div>
      ))}
    </dl>
  );
}
