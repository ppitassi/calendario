import { NextRequest } from "next/server";
import { handleApi } from "../../../../../../lib/api-core";
export const runtime = "nodejs";
export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string; month: string }> }) { return handleApi("POST", "/presentation/[clientId]/[month]/pdf-jobs", req, await params); }
