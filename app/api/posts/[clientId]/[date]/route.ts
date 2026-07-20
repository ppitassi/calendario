import { NextRequest } from 'next/server';
import { handleApi } from '../../../../../lib/api-core';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ clientId: string; date: string }> }) {
  const resolvedParams = await params;
  return handleApi('DELETE', '/posts/[clientId]/[date]', req, resolvedParams);
}
