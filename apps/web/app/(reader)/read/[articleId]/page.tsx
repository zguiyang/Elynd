import { ReaderPage } from '@/features/reader';

type ReadArticlePageProps = {
  params: Promise<{ articleId: string }>;
};

export default async function ReadArticlePage({ params }: ReadArticlePageProps) {
  const { articleId } = await params;
  return <ReaderPage key={articleId} articleId={articleId} />;
}
