import { NextRequest } from 'next/server';
import { handleApi } from '../../../../lib/api-core';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const resolvedParams = await params;
  return handleApi('POST', '/posts-bulk/[clientId]', req, resolvedParams);
}
