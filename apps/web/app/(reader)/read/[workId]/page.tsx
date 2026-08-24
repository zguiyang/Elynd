import { ReaderPage } from '@/features/reader/reader-page';

type PageProps = {
  params: Promise<{ workId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { workId } = await params;
  return <ReaderPage key={workId} workId={workId} />;
}
