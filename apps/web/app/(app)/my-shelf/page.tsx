import { Suspense } from 'react';

import { ShelfPage } from '@/features/shelf';
import { ShelfSkeleton } from '@/features/shelf/shelf-skeleton';

export default function MyShelfPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-5xl">
          <ShelfSkeleton />
        </div>
      }
    >
      <ShelfPage />
    </Suspense>
  );
}
