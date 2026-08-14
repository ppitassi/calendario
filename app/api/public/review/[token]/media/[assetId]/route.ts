import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../../../lib/db';
import { isReviewDataError, validateReviewPost, validateReviewToken } from '../../../../../../../lib/review-data';
import { serveResolvedAsset } from '../../../../../media/assets/[assetId]/content/route';

async function resolvePublicAsset(token: string, assetId: string) {
  const tokenData: any = await validateReviewToken(token);
  if (isReviewDataError(tokenData)) return { error: NextResponse.json({ error: tokenData.error }, { status: tokenData.status }) };
  const [rows]: any = await getDbPool().query(
    `SELECT DISTINCT m.* FROM media_assets m
     JOIN posts p ON p.id=m.ownerId AND p.clientId=m.clientId
     JOIN post_artwork_version_items i ON i.mediaAssetId=m.id
     JOIN post_artwork_versions v ON v.id=i.artworkVersionId AND v.postId=p.id
     WHERE m.id=? AND m.status='active' AND m.ownerType='post' AND m.clientId=? AND v.status IN ('awaiting_approval','approved','superseded') LIMIT 1`,
    [assetId, tokenData.clientId],
  );
  const asset = rows[0];
  if (!asset) return { error: NextResponse.json({ error: 'Mídia não autorizada para esta revisão.' }, { status: 404 }) };
  const postAccess = await validateReviewPost(token, asset.ownerId);
  if (isReviewDataError(postAccess)) return { error: NextResponse.json({ error: postAccess.error }, { status: postAccess.status }) };
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
