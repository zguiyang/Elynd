import { BookDetailPage } from '@/features/book-detail/book-detail-page';

type PageProps = {
  params: Promise<{ workId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { workId } = await params;
  return <BookDetailPage key={workId} workId={workId} />;
}
