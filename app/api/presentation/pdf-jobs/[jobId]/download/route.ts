import { NextRequest } from "next/server";
import { handleApi } from "../../../../../../lib/api-core";
export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) { return handleApi("GET", "/presentation/pdf-jobs/[jobId]/download", req, await params); }
