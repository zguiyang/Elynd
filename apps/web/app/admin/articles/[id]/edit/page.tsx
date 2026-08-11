import { ArticleFormPage } from '@/features/admin/article-form-page';

type AdminArticleEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminArticleEditPage({ params }: AdminArticleEditPageProps) {
  const { id } = await params;
  return <ArticleFormPage key={id} mode="edit" articleId={id} />;
}
