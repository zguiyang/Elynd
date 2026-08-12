import { Suspense } from 'react';

import { LibraryPage } from '@/features/library/library-page';

export default function LibraryRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">正在整理书架…</p>}>
      <LibraryPage />
    </Suspense>
  );
}
