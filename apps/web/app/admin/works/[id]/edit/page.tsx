import { WorksFormPage } from '@/features/admin/works-form-page';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminWorkEditPage({ params }: PageProps) {
  const { id } = await params;
  return <WorksFormPage key={id} mode="edit" workId={id} />;
}
