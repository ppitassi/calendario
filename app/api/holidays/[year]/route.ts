import { NextRequest } from 'next/server';
import { handleApi } from '../../../../lib/api-core';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ year: string }> }) {
  const resolvedParams = await params;
  return handleApi('GET', '/holidays/[year]', req, resolvedParams);
}
