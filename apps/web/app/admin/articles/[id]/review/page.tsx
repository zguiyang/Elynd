import { ArticleReviewPage } from '@/features/admin/article-review-page';

type AdminArticleReviewRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminArticleReviewRoute({ params }: AdminArticleReviewRouteProps) {
  const { id } = await params;
  return <ArticleReviewPage key={id} articleId={id} />;
}
