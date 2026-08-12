import { LearnPracticePage } from '@/features/learn/practice-page';

type LearnPracticeRouteProps = {
  params: Promise<{ articleId: string }>;
};

export default async function LearnPracticeRoute({ params }: LearnPracticeRouteProps) {
  const { articleId } = await params;
  return <LearnPracticePage articleId={articleId} />;
}
