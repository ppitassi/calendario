import { notFound } from 'next/navigation';
import { getReviewData } from '../../../../lib/next-review';
import { buildPresentationViewModel } from '../../../../lib/presentation-model';
import { StaticPresentationDocument } from '../../../../src/components/StaticPresentationDocument';
import { resolvePresentationMedia } from '../../../../lib/presentation-pdf-jobs';

export default async function ReviewExportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getReviewData(token);

  if ('error' in data) {
    if (data.status === 404) notFound();
    return <main style={{ padding: 48 }}>{data.error}</main>;
  }

  const model = buildPresentationViewModel(data);
  model.responsaveis = [];
  await resolvePresentationMedia(model);
  return <StaticPresentationDocument model={model} />;
}
