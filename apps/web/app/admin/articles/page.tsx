import { Suspense } from 'react';

import { ArticlesListPage } from '@/features/admin/articles-list-page';

export default function AdminArticlesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">加载文章列表…</p>}>
      <ArticlesListPage />
    </Suspense>
  );
}
