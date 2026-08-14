import { NextRequest } from 'next/server';
import { handleApi } from '../../../../lib/api-core';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return handleApi('GET', '/users/me', req, {});
}

export async function PATCH(req: NextRequest) {
  return handleApi('PATCH', '/users/me', req, {});
}
