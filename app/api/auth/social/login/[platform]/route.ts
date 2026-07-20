import { NextRequest } from 'next/server';
import { handleApi } from '../../../../../../lib/api-core';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const resolvedParams = await params;
  return handleApi('GET', '/auth/social/login/[platform]', req, resolvedParams);
}
