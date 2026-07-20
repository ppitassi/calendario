import { NextRequest } from 'next/server';
import { handleApi } from '../../../../../../lib/api-core';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params;
  return handleApi('POST', '/public/review/[token]/send-whatsapp', req, resolvedParams);
}
