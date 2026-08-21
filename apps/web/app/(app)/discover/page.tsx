import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { DiscoverPage } from '@/features/discover';

function DiscoverRouteFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-10 w-28 rounded-md" />
        <Skeleton className="mx-auto h-5 w-56 rounded-md" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-8">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-2xl md:h-96" />
        ))}
      </div>
    </div>
  );
}

export default function DiscoverRoutePage() {
  return (
    <Suspense fallback={<DiscoverRouteFallback />}>
      <DiscoverPage />
    </Suspense>
  );
}
