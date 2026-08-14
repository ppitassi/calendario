import { NextRequest, NextResponse } from "next/server";
import { rows } from "../../../../../../../lib/db";
import { pdfJob, snapshotModel, validRenderToken } from "../../../../../../../lib/presentation-pdf-jobs";
import { serveResolvedAsset } from "../../../../../media/assets/[assetId]/content/route";
export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string; assetId: string }> }) {
  const { jobId, assetId } = await params; const job = await pdfJob(jobId); const token = req.nextUrl.searchParams.get("token") || "";
  if (!validRenderToken(job, token)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const model = await snapshotModel(job.snapshotId); const allowed = model?.cliente.logoAssetId===assetId||model?.posts.some(post => post.midias.some(media => media.assetId === assetId));
  if (!allowed) return NextResponse.json({ error: "Mídia fora do escopo." }, { status: 403 });
  const asset = (await rows("SELECT * FROM media_assets WHERE id=? AND status='active' LIMIT 1", [assetId]))[0];
  return asset ? serveResolvedAsset(req, asset) : NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
}
