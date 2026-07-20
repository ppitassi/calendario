import { NextRequest } from 'next/server';
import { handleApi } from '../../../../lib/api-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handleApi('GET', '/cron/deadlines', req, {});
}
