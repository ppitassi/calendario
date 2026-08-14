import { NextRequest } from "next/server";
import { handleApi } from "../../../../lib/api-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) { return handleApi("GET", "/media/assets", req, {}); }
