import { NextRequest } from 'next/server';
import { handleApi } from '../../../../../lib/api-core';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ clientId: string }> }) {
  const resolvedParams = await ctx.params;
  const params = { postId: resolvedParams.clientId };
  return handleApi('GET', '/posts/[postId]/comments', req, params);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ clientId: string }> }) {
  const resolvedParams = await ctx.params;
  const params = { postId: resolvedParams.clientId };
  return handleApi('POST', '/posts/[postId]/comments', req, params);
}
