import { NextRequest } from 'next/server';
import { finishOAuth } from '../../../../../../lib/social-oauth';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) { return finishOAuth(req, 'facebook'); }
