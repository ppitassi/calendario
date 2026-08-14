import { NextRequest } from 'next/server';
import { startOAuth } from '../../../../../../lib/social-oauth';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) { return startOAuth(req, 'instagram'); }
