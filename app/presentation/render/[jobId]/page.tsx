import { notFound } from "next/navigation";
import { pdfJob, snapshotModel, validRenderToken } from "../../../../lib/presentation-pdf-jobs";
import { StaticPresentationDocument } from "../../../../src/components/StaticPresentationDocument";

export default async function PdfRenderPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<{ token?: string }> }) {
  const { jobId } = await params; const { token = "" } = await searchParams; const job = await pdfJob(jobId);
  if (!validRenderToken(job, token)) notFound();
  const model = await snapshotModel(job.snapshotId); if (!model) notFound();
  const mediaUrl = (assetId: string, fallback: string) => `/api/presentation/pdf-jobs/${encodeURIComponent(jobId)}/media/${encodeURIComponent(assetId)}?token=${encodeURIComponent(token)}&fallback=${encodeURIComponent(fallback)}`;
  return <StaticPresentationDocument model={model} mediaUrl={mediaUrl} />;
}
