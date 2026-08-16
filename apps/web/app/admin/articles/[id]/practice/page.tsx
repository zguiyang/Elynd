import { ArticlePracticePage } from '@/features/admin/article-practice-page';

type AdminArticlePracticeRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminArticlePracticeRoute({ params }: AdminArticlePracticeRouteProps) {
  const { id } = await params;
  return <ArticlePracticePage key={id} articleId={id} />;
}
