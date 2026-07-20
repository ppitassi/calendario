import { NextRequest } from 'next/server';
import { handleApi } from '../../../../../lib/api-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleApi('POST', '/uploads/media/init', req, {});
}
