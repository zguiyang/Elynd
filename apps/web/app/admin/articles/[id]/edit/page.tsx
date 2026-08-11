import { notFound } from 'next/navigation';

import { ArticleFormPage } from '@/features/admin/article-form-page';
import { getMockArticle } from '@/features/admin/articles-mock-data';

type AdminArticleEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminArticleEditPage({ params }: AdminArticleEditPageProps) {
  const { id } = await params;
  const article = getMockArticle(id);
  if (!article) {
    notFound();
  }

  return <ArticleFormPage mode="edit" initialArticle={article} />;
}
