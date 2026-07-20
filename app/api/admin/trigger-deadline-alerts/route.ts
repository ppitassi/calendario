import { NextRequest } from 'next/server';
import { handleApi } from '../../../../lib/api-core';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, _ctx: { params?: Promise<Record<string, string>> }) {
  const resolvedParams = {};
  return handleApi('POST', '/admin/trigger-deadline-alerts', req, resolvedParams);
}
