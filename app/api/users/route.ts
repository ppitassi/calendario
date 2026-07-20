import { NextRequest } from 'next/server';
import { handleApi } from '../../../lib/api-core';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, _ctx: { params?: Promise<Record<string, string>> }) {
  const resolvedParams = {};
  return handleApi('GET', '/users', req, resolvedParams);
}

export async function POST(req: NextRequest, _ctx: { params?: Promise<Record<string, string>> }) {
  const resolvedParams = {};
  return handleApi('POST', '/users', req, resolvedParams);
}
