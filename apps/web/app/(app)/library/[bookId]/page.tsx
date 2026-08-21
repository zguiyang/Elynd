import { BookDetailPage } from '@/features/book-detail';

type BookDetailRouteProps = {
  params: Promise<{ bookId: string }>;
};

export default async function BookDetailRoutePage({ params }: BookDetailRouteProps) {
  const { bookId } = await params;
  return <BookDetailPage bookId={bookId} />;
}
