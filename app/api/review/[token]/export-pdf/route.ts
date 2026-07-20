import { NextRequest } from 'next/server';
import { handleApi } from '../../../../../lib/api-core';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params;
  return handleApi('GET', '/review/[token]/export-pdf', req, resolvedParams);
}
