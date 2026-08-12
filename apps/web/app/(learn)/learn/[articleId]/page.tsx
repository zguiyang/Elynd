import { LearnRoomPage } from '@/features/learn/learn-room-page';

type LearnArticlePageProps = {
  params: Promise<{ articleId: string }>;
};

export default async function LearnArticlePage({ params }: LearnArticlePageProps) {
  const { articleId } = await params;
  return <LearnRoomPage articleId={articleId} />;
}
