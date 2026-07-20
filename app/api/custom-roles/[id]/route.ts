import { NextRequest } from 'next/server';
import { handleApi } from '../../../../lib/api-core';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return handleApi('DELETE', '/custom-roles/[id]', req, resolvedParams);
}
