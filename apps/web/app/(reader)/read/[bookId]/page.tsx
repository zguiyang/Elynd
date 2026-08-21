import { ReaderPage } from '@/features/reader';

type ReadBookPageProps = {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ unavailable?: string; chapter?: string }>;
};

export default async function ReadBookPage({ params, searchParams }: ReadBookPageProps) {
  const { bookId } = await params;
  const query = await searchParams;
  return (
    <ReaderPage
      key={`${bookId}:${query.chapter ?? ''}:${query.unavailable === '1' ? '1' : '0'}`}
      bookId={bookId}
      chapterId={query.chapter ?? null}
      forceUnavailable={query.unavailable === '1'}
    />
  );
}
