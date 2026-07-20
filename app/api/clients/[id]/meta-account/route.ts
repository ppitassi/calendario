import { NextRequest } from 'next/server';
import { handleApi } from '../../../../../lib/api-core';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return handleApi('POST', '/clients/[id]/meta-account', req, resolvedParams);
}
