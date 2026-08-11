import { ArticleReaderPage } from '@/features/library/article-reader-page';

type LibraryArticleRoutePageProps = {
  params: Promise<{ articleId: string }>;
};

export default async function LibraryArticleRoutePage({ params }: LibraryArticleRoutePageProps) {
  const { articleId } = await params;
  return <ArticleReaderPage articleId={articleId} />;
}
