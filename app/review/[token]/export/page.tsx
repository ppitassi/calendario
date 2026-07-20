import { notFound } from 'next/navigation';
import { getReviewData } from '../../../../lib/next-review';
import ReviewDocument from '../review-document';

export default async function ReviewExportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getReviewData(token);

  if ('error' in data) {
    if (data.status === 404) notFound();
    return <main style={{ padding: 48 }}>{data.error}</main>;
  }

  return <ReviewDocument data={data} token={token} isExport />;
}