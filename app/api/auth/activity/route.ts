import { NextRequest } from 'next/server';
import { handleApi } from '../../../../lib/api-core';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return handleApi('POST', '/auth/activity', req, {});
}
