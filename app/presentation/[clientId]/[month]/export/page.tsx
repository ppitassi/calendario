import { notFound } from 'next/navigation';
import { getPresentationData } from '../../../../../lib/next-review';
import ReviewDocument from '../../../../review/[token]/review-document';

export default async function PresentationExportPage({ params }: { params: Promise<{ clientId: string; month: string }> }) {
  const { clientId, month } = await params;
  const data = await getPresentationData(clientId, month);

  if ('error' in data) {
    if (data.status === 404) notFound();
    return <main style={{ padding: 48 }}>{data.error}</main>;
  }

  return <ReviewDocument data={data} token={`${clientId}/${month}`} isExport />;
}
