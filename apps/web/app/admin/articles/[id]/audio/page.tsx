import { ArticleAudioPage } from '@/features/admin/article-audio-page';

type AdminArticleAudioRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminArticleAudioRoute({ params }: AdminArticleAudioRouteProps) {
  const { id } = await params;
  return <ArticleAudioPage key={id} articleId={id} />;
}
