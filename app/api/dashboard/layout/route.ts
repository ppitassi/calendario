import { NextRequest } from 'next/server';
import { handleApi } from '../../../../lib/api-core';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return handleApi('GET', '/dashboard/layout', req, {});
}

export async function PUT(req: NextRequest) {
  return handleApi('PUT', '/dashboard/layout', req, {});
}

export async function DELETE(req: NextRequest) {
  return handleApi('DELETE', '/dashboard/layout', req, {});
}
