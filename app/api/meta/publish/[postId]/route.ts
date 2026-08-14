import { NextRequest } from 'next/server';
import { handleApi } from '../../../../../lib/api-core';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  return handleApi('POST', '/meta/publish/[postId]', req, await params);
}
