import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../../../lib/db';
import { isReviewDataError, validateReviewToken } from '../../../../../../../lib/review-data';
import { serveResolvedAsset } from '../../../../../media/assets/[assetId]/content/route';

async function resolvePublicAsset(token: string, assetId: string) {
  const tokenData: any = await validateReviewToken(token);
  if (isReviewDataError(tokenData)) return { error: NextResponse.json({ error: tokenData.error }, { status: tokenData.status }) };
  const [rows]: any = await getDbPool().query(
    `SELECT DISTINCT m.id,m.storage_provider storageProvider,m.storage_key storageKey,m.original_name originalName,m.mime_type mimeType,m.byte_size byteSize,m.checksum_sha256 checksum
     FROM public_approval_tokens t JOIN public_token_assets ta ON ta.public_token_id=t.id
     JOIN asset_versions av ON av.id=ta.asset_version_id JOIN media_assets m ON m.id=av.media_asset_id
     WHERE t.id=? AND m.id=? AND m.deleted_at IS NULL LIMIT 1`,
    [tokenData.id, assetId],
  );
  const asset = rows[0];
  if (!asset) return { error: NextResponse.json({ error: 'Mídia não autorizada para esta revisão.' }, { status: 404 }) };
  return { asset };
}

async function respond(req: NextRequest, params: Promise<{ token: string; assetId: string }>, headOnly: boolean) {
  const { token, assetId } = await params;
  const resolved = await resolvePublicAsset(token, assetId);
  if (resolved.error) return resolved.error;
  return serveResolvedAsset(req, resolved.asset, headOnly);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; assetId: string }> }) {
  return respond(req, params, false);
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ token: string; assetId: string }> }) {
  return respond(req, params, true);
}
