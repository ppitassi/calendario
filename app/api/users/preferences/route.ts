import { NextRequest } from 'next/server';
import { handleApi } from '../../../../lib/api-core';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return handleApi('GET', '/users/preferences', req, {});
}

export async function POST(req: NextRequest) {
  return handleApi('POST', '/users/preferences', req, {});
}
