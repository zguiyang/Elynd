import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { HistoryPage } from '@/features/history';

function HistoryRouteFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-10 w-40 rounded-md" />
        <Skeleton className="mx-auto h-5 w-64 rounded-md" />
      </div>
      <Skeleton className="mx-auto h-20 w-full max-w-reading-column rounded-xl" />
      <Skeleton className="mx-auto h-40 w-full max-w-reading-column rounded-2xl" />
      <div className="mx-auto w-full max-w-reading-column space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function ReadingHistoryRoutePage() {
  return (
    <Suspense fallback={<HistoryRouteFallback />}>
      <HistoryPage />
    </Suspense>
  );
}
