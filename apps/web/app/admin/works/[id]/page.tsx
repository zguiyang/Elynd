import { WorksWorkflowPage } from '@/features/admin/works-workflow-page';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminWorkDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <WorksWorkflowPage key={id} workId={id} />;
}
