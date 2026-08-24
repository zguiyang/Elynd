import { BookDetailPage } from '@/features/book-detail';

type BookDetailRouteProps = {
  params: Promise<{ articleId: string }>;
};

export default async function BookDetailRoutePage({ params }: BookDetailRouteProps) {
  const { articleId } = await params;
  return <BookDetailPage articleId={articleId} />;
}
