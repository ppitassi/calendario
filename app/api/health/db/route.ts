import { NextRequest } from 'next/server';
import { handleApi } from '../../../../lib/api-core';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, _ctx: { params?: Promise<Record<string, string>> }) {
  const resolvedParams = {};
  return handleApi('GET', '/health/db', req, resolvedParams);
}
