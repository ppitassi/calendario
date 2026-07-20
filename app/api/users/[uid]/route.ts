import { NextRequest } from 'next/server';
import { handleApi } from '../../../../lib/api-core';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const resolvedParams = await params;
  return handleApi('GET', '/users/[uid]', req, resolvedParams);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const resolvedParams = await params;
  return handleApi('DELETE', '/users/[uid]', req, resolvedParams);
}
