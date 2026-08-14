import { NextRequest } from 'next/server';
import { handleApi } from '../../../lib/api-core';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  return handleApi('GET', '/production-gallery', req, {});
}
