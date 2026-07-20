import { NextRequest } from 'next/server';
import { handleApi } from '../../../../../../../../lib/api-core';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; postId: string }> }) {
  const resolvedParams = await params;
  return handleApi('GET', '/public/review/[token]/posts/[postId]/comments', req, resolvedParams);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string; postId: string }> }) {
  const resolvedParams = await params;
  return handleApi('POST', '/public/review/[token]/posts/[postId]/comments', req, resolvedParams);
}
